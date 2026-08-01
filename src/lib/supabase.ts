import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase credentials in .env');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

export interface MatchedProfile {
  id?: string;
  name: string;
  relation: string;
  last_summary?: string;
  distance?: number;
}

export interface NewProfileInput {
  name: string;
  relation: string;
  face_descriptor: number[];
  last_summary?: string;
}

/**
 * Searches the database for a matching face vector using the match_face PostgreSQL RPC function.
 * Returns ONLY the matched profile data without returning face vectors.
 */
export const searchFaceInDatabase = async (
  descriptor: number[] | Float32Array,
  threshold = 0.55
): Promise<MatchedProfile | null> => {
  try {
    const queryEmbedding = Array.from(descriptor);
    const { data, error } = await supabase.rpc('match_face', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
    });

    if (error) {
      console.warn("RPC match_face error (or table/function not set up yet):", error);
      return null;
    }

    if (data && data.length > 0) {
      return data[0] as MatchedProfile;
    }

    return null;
  } catch (err) {
    console.error("Failed to execute searchFaceInDatabase:", err);
    return null;
  }
};

/**
 * Inserts a new profile into the database. Strictly triggered ONLY when voice trigger words are detected.
 */
export const createProfile = async (profile: NewProfileInput): Promise<MatchedProfile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .insert([profile])
    .select('id, name, relation, last_summary');

  if (error) {
    console.error("Error creating profile:", error);
    throw error;
  }
  return data?.[0] as MatchedProfile;
};

export const updateProfileSummary = async (nameOrId: string, summary: string) => {
  try {
    if (!nameOrId || !summary) return;
    
    // If it looks like a UUID or contains a hyphen, try by ID first
    if (nameOrId.includes('-')) {
      const { data, error } = await supabase
        .from('profiles')
        .update({ last_summary: summary })
        .eq('id', nameOrId)
        .select('id, name, last_summary');
      
      if (!error && data && data.length > 0) {
        console.log(`[Supabase] Summary saved for ID ${nameOrId}:`, summary);
        return;
      }
    }

    // Try by name
    const { data, error } = await supabase
      .from('profiles')
      .update({ last_summary: summary })
      .eq('name', nameOrId)
      .select('id, name, last_summary');
      
    if (error) {
      console.error("[Supabase] Error updating profile summary:", error);
    } else {
      console.log(`[Supabase] Summary saved for ${nameOrId}:`, summary);
    }
  } catch (err) {
    console.error("[Supabase] Failed to update profile summary:", err);
  }
};

export const updateProfileRelation = async (nameOrId: string, relation: string) => {
  const query = nameOrId.includes('-') 
    ? supabase.from('profiles').update({ relation }).eq('id', nameOrId)
    : supabase.from('profiles').update({ relation }).eq('name', nameOrId);
  const { error } = await query;
  if (error) {
    console.error("Error updating profile relation:", error);
  }
};

export const updateProfileName = async (nameOrId: string, newName: string, relation?: string) => {
  const updatePayload: Record<string, string> = { name: newName };
  if (relation) updatePayload.relation = relation;

  const query = nameOrId.includes('-')
    ? supabase.from('profiles').update(updatePayload).eq('id', nameOrId)
    : supabase.from('profiles').update(updatePayload).eq('name', nameOrId);
  const { error } = await query;
  if (error) {
    console.error("Error updating profile name:", error);
  }
};

/**
 * Updates the existing profile if face/id exists, or creates a new one only if the face is new.
 * Guarantees NO duplicate profiles are created when changing name or relation.
 */
export const saveOrUpdateProfile = async (
  currentProfile: MatchedProfile | null,
  descriptor: Float32Array | number[],
  newName: string,
  newRelation?: string
): Promise<MatchedProfile | null> => {
  // 1. If an active profile with an ID exists, update it directly:
  if (currentProfile?.id) {
    const updatePayload: Record<string, string> = { name: newName };
    if (newRelation) updatePayload.relation = newRelation;

    const { data, error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', currentProfile.id)
      .select('id, name, relation, last_summary');

    if (!error && data && data.length > 0) {
      return data[0] as MatchedProfile;
    }
  }

  // 2. Check if this face vector matches any existing profile in the database:
  const matched = await searchFaceInDatabase(descriptor);
  if (matched?.id) {
    const updatePayload: Record<string, string> = { name: newName };
    if (newRelation) updatePayload.relation = newRelation;

    const { data, error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', matched.id)
      .select('id, name, relation, last_summary');

    if (!error && data && data.length > 0) {
      return data[0] as MatchedProfile;
    }
  }

  // 3. Only if it is a truly new face, create a new profile:
  const descriptorArray = Array.from(descriptor);
  return await createProfile({
    name: newName,
    relation: newRelation || "Friend",
    face_descriptor: descriptorArray,
    last_summary: "First meeting recorded.",
  });
};

