import Webcam from "react-webcam";
import { useState, useRef, useEffect, useCallback } from "react";
import { CameraOff } from "lucide-react";
import * as faceapi from "@vladmandic/face-api";

interface VisionLayerProps {
  onFaceDetected?: (descriptor: Float32Array | null) => void;
}

const VisionLayer = ({ onFaceDetected }: VisionLayerProps) => {
  const [hasCamera, setHasCamera] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setIsLoaded(true);
      } catch (err) {
        console.error("Failed to load face-api models", err);
        setError("Camera vision initializing...");
      }
    };
    loadModels();
  }, []);

  const detectFaces = useCallback(async () => {
    if (!isLoaded || !webcamRef.current?.video || !canvasRef.current) return;
    const video = webcamRef.current.video;
    
    if (video.readyState === 4) {
      const detections = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      const canvas = canvasRef.current;
      const displaySize = { width: video.videoWidth, height: video.videoHeight };
      
      if (canvas.width !== displaySize.width || canvas.height !== displaySize.height) {
        faceapi.matchDimensions(canvas, displaySize);
      }

      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);

      if (detections) {
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        
        // Ultra-subtle, warm soft focus frame (calm & non-distracting)
        if (ctx) {
          const { x, y, width, height } = resizedDetections.detection.box;
          const radius = 12;
          
          ctx.beginPath();
          ctx.strokeStyle = "rgba(243, 168, 59, 0.35)"; // Soft warm amber
          ctx.lineWidth = 2;
          ctx.roundRect(x, y, width, height, radius);
          ctx.stroke();
        }

        if (onFaceDetected) {
          onFaceDetected(detections.descriptor);
        }
      } else {
        if (onFaceDetected) {
          onFaceDetected(null);
        }
      }
    }
  }, [isLoaded, onFaceDetected]);

  useEffect(() => {
    const interval = setInterval(() => {
      detectFaces();
    }, 250);
    return () => clearInterval(interval);
  }, [detectFaces]);

  return (
    <div className="fixed inset-0 z-0 bg-background">
      {hasCamera ? (
        <div className="relative h-full w-full">
          <Webcam
            audio={false}
            mirrored
            ref={webcamRef}
            className="h-full w-full object-cover brightness-[0.96] contrast-[1.02]"
            videoConstraints={{
              facingMode: "user",
              width: 1920,
              height: 1080,
            }}
            onUserMediaError={() => setHasCamera(false)}
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full object-cover pointer-events-none"
            style={{ transform: "scaleX(-1)" }} 
          />
        </div>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center bg-background p-6">
          <CameraOff className="mb-4 h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground/60">
            {error || "Camera feed unavailable"}
          </p>
        </div>
      )}
      {/* Soft warm vignette */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 60%, rgba(26, 22, 20, 0.45) 100%)",
        }}
      />
    </div>
  );
};

export default VisionLayer;
