import { useState } from "react";
import { UserPlus, X, Sparkles, Check, Heart, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveOrUpdateProfile, MatchedProfile } from "@/lib/supabase";
import { speakMemoryContext } from "@/lib/tts";
import { useToast } from "@/hooks/use-toast";

interface RegisterPersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  faceDescriptor: Float32Array | null;
  onRegistered: (profile: MatchedProfile) => void;
  defaultName?: string;
  defaultRelation?: string;
}

const QUICK_RELATIONS = ["Son", "Daughter", "Doctor", "Nurse", "Caregiver", "Friend", "Spouse", "Grandchild"];

const RegisterPersonModal = ({
  isOpen,
  onClose,
  faceDescriptor,
  onRegistered,
  defaultName = "",
  defaultRelation = "",
}: RegisterPersonModalProps) => {
  const [name, setName] = useState(defaultName);
  const [relation, setRelation] = useState(defaultRelation || "Friend");
  const [summary, setSummary] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter the person's name.",
        variant: "destructive",
      });
      return;
    }

    if (!faceDescriptor) {
      toast({
        title: "No face detected",
        description: "Please position the person in front of the camera.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const initialSummary = summary.trim() || `Met on ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`;
      const savedProfile = await saveOrUpdateProfile(
        null,
        faceDescriptor,
        name.trim(),
        relation.trim()
      );

      if (savedProfile) {
        onRegistered(savedProfile);
        speakMemoryContext(savedProfile.name, savedProfile.relation, savedProfile.last_summary || initialSummary);
        toast({
          title: "Account Registered",
          description: `${savedProfile.name} (${savedProfile.relation}) has been enrolled successfully.`,
        });
        onClose();
      }
    } catch (err) {
      console.error("Failed to register person:", err);
      toast({
        title: "Registration Failed",
        description: "Unable to save profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/20 backdrop-blur-md p-4 animate-glass-in">
      {/* Frosted Glass Screen with Dark Text */}
      <div 
        className="glass-panel-black relative w-full max-w-md rounded-3xl p-6 md:p-8 shadow-2xl"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-xl glass-inner-black opacity-80 hover:opacity-100 hover:bg-slate-900/10 transition-all duration-200"
          title="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-6 flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl glass-inner-black shadow-inner">
            <UserPlus className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-widest opacity-70">
                SecondSight ID
              </span>
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            </div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight mt-0.5">
              Register New Person
            </h2>
          </div>
        </div>

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider opacity-80 mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah, Dr. Robert"
              className="glass-input-black w-full rounded-2xl px-4 py-3 text-sm font-semibold placeholder:opacity-50 focus:outline-none transition-all duration-200"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider opacity-80 mb-1.5">
              Relationship / Role
            </label>
            <input
              type="text"
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
              placeholder="e.g. Daughter, Caregiver, Doctor"
              className="glass-input-black w-full rounded-2xl px-4 py-3 text-sm font-semibold placeholder:opacity-50 focus:outline-none transition-all duration-200"
            />

            {/* Quick Relationship Selectors */}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {QUICK_RELATIONS.map((rel) => (
                <button
                  key={rel}
                  type="button"
                  onClick={() => setRelation(rel)}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-all duration-200 ${
                    relation === rel 
                      ? "glass-pill-active" 
                      : "glass-pill opacity-75 hover:opacity-100"
                  }`}
                >
                  {rel}
                </button>
              ))}
            </div>
          </div>

          {/* Memory Summary Input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider opacity-80 mb-1.5">
              Initial Memory
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder={`Met on ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`}
              rows={2}
              className="glass-input-black w-full rounded-2xl px-4 py-3 text-sm font-semibold placeholder:opacity-50 focus:outline-none transition-all duration-200 resize-none"
            />
          </div>

          {/* Guidelines */}
          <div className="glass-inner-black rounded-2xl p-3 flex items-start gap-2.5 mt-2">
            <Shield className="h-4 w-4 opacity-50 shrink-0 mt-0.5" />
            <p className="text-[10px] opacity-70 leading-relaxed font-semibold">
              This person's face encodings and memories will be stored securely and locally on your device for future recognition.
            </p>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={isSaving}
              className="w-full glass-button gap-2 rounded-2xl py-6 text-sm font-black tracking-wide shadow-xl"
            >
              {isSaving ? (
                <>
                  <Sparkles className="h-4 w-4 animate-pulse" />
                  Registering Person...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Complete Registration
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterPersonModal;
