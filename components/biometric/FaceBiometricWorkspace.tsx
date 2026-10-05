"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Eye,
  LoaderCircle,
  UserRoundCheck,
  Video,
  VideoOff,
} from "lucide-react";
import HeaderAccount from "@/components/HeaderAccount";
import { createClient } from "@/utils/supabase/client";

type Mode = "enrollment" | "attendance";
type ChallengeId = "left" | "right" | "up" | "down" | "blink";
type ScanState = "idle" | "loading" | "ready" | "scanning" | "complete" | "error";
type HorizontalDirection = "positive" | "negative";
type FaceMeshPoint = { x: number; y: number };

type HumanFace = {
  embedding?: number[];
  boxScore?: number;
  faceScore?: number;
  live?: number;
  real?: number;
  box?: [number, number, number, number];
  mesh?: FaceMeshPoint[];
  rotation?: { angle: { yaw: number; pitch: number } } | null;
};

type HumanResult = {
  face: HumanFace[];
  gesture: Array<{ gesture: string }>;
};

type HumanInstance = {
  version: string;
  load: () => Promise<void>;
  detect: (input: HTMLVideoElement) => Promise<HumanResult>;
};

type FaceTemplate = {
  descriptors: number[][];
  createdAt: string;
  modelVersion: string;
  embeddingModel: "insightface-mobilenet-swish";
};

type DailyAttendance = {
  id: string;
  clock_in: string;
  clock_out: string | null;
};

// Cosine similarity for the InsightFace embedding. This is a provisional
// security threshold and must be calibrated with genuine and impostor tests.
const MIN_IDENTITY_SIMILARITY = 0.7;
const REQUIRED_STABLE_MATCHES = 8;
const REQUIRED_MISMATCH_FRAMES = 3;
const SIMILARITY_WINDOW_SIZE = 10;
const IDENTITY_RESET_MARGIN = 0.12;
const MIN_FACE_SIZE_PX = 180;
const CHALLENGE_HOLD_DURATION_MS = 450;
const BLINK_CONFIRMATION_FRAMES = 2;
const ENROLLMENT_SAMPLE_INTERVAL_MS = 350;
const REQUIRED_ENROLLMENT_SAMPLES = 15;

const challengeDetails: Record<ChallengeId, { label: string; helper: string }> = {
  left: { label: "Hadap kiri", helper: "Putar wajah sedikit ke kiri." },
  right: { label: "Hadap kanan", helper: "Putar wajah sedikit ke kanan." },
  up: { label: "Lihat atas", helper: "Angkat kepala sedikit ke atas." },
  down: { label: "Lihat bawah", helper: "Turunkan kepala sedikit ke bawah." },
  blink: { label: "Kedip", helper: "Kedipkan salah satu mata satu kali." },
};

// Human reports head rotation in radians, while the UX thresholds below are
// easier to reason about in degrees. Keeping the conversion explicit avoids a
// 15-radian comparison that would never be reached by a normal head turn.
const degreesToRadians = (degrees: number) => degrees * (Math.PI / 180);
const CENTER_YAW_THRESHOLD = degreesToRadians(10);
const CENTER_PITCH_THRESHOLD = degreesToRadians(10);
const TURN_YAW_THRESHOLD = degreesToRadians(15);
const TILT_PITCH_THRESHOLD = degreesToRadians(12);

const FACE_OVERLAY_PATHS = [
  [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10],
  [33, 160, 158, 133, 153, 144, 33],
  [362, 385, 387, 263, 373, 380, 362],
  [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78, 61],
  [168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 168],
];

function shuffleChallenges() {
  const values: ChallengeId[] = ["left", "right", "up", "down", "blink"];
  for (let index = values.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [values[index], values[target]] = [values[target], values[index]];
  }
  return values;
}

function formatTime(timestamp: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function getJakartaDate(timestamp = new Date()) {
  const values = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(timestamp);
  const part = (type: Intl.DateTimeFormatPartTypes) => values.find((value) => value.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function livenessLabel(value: number | undefined) {
  if (typeof value !== "number") return "Menunggu pembacaan";
  if (value >= 0.6) return "Terdeteksi hidup";
  return "Perlu pencahayaan lebih baik";
}

function cosineSimilarity(first: number[], second: number[]) {
  if (first.length !== second.length || first.length === 0) return 0;
  let dotProduct = 0;
  let firstMagnitude = 0;
  let secondMagnitude = 0;
  for (let index = 0; index < first.length; index += 1) {
    dotProduct += first[index] * second[index];
    firstMagnitude += first[index] * first[index];
    secondMagnitude += second[index] * second[index];
  }
  if (firstMagnitude === 0 || secondMagnitude === 0) return 0;
  return Math.max(-1, Math.min(1, dotProduct / (Math.sqrt(firstMagnitude) * Math.sqrt(secondMagnitude))));
}

function templateSimilarity(embedding: number[], descriptors: number[][]) {
  if (descriptors.length === 0) return 0;
  const averaged = Array.from({ length: embedding.length }, (_, index) => (
    descriptors.reduce((total, descriptor) => total + (descriptor[index] ?? 0), 0) / descriptors.length
  ));
  return cosineSimilarity(embedding, averaged);
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export default function FaceBiometricWorkspace({ mode }: { mode: Mode }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const humanRef = useRef<HumanInstance | null>(null);
  const templateRef = useRef<FaceTemplate | null>(null);
  const frameRef = useRef<number | null>(null);
  const isDetectingRef = useRef(false);
  const latestEmbeddingRef = useRef<number[] | null>(null);
  const enrollmentSamplesRef = useRef<number[][]>([]);
  const lastEnrollmentSampleAtRef = useRef(0);
  const lastMeshRenderAtRef = useRef(0);
  const challengeOrderRef = useRef<ChallengeId[]>([]);
  const completedChallengesRef = useRef<ChallengeId[]>([]);
  const horizontalCalibrationRef = useRef<{ firstChallenge: "left" | "right"; direction: HorizontalDirection } | null>(null);
  const challengeStartedAtRef = useRef<number | null>(null);
  const challengeFramesRef = useRef(0);
  const stableMatchFramesRef = useRef(0);
  const mismatchFramesRef = useRef(0);
  const similarityWindowRef = useRef<number[]>([]);
  const identityVerifiedRef = useRef(false);
  const matchScoreRef = useRef<number | null>(null);
  const qualityPassedRef = useRef(false);
  const attendancePresenceRef = useRef(false);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [template, setTemplate] = useState<FaceTemplate | null>(null);
  const [challengeOrder, setChallengeOrder] = useState<ChallengeId[]>([]);
  const [completedChallenges, setCompletedChallenges] = useState<ChallengeId[]>([]);
  const [faceCount, setFaceCount] = useState(0);
  const [faceConfidence, setFaceConfidence] = useState(0);
  const [livenessScore, setLivenessScore] = useState<number | undefined>();
  const [antiSpoofScore, setAntiSpoofScore] = useState<number | undefined>();
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [stableMatchFrames, setStableMatchFrames] = useState(0);
  const [identityVerified, setIdentityVerified] = useState(false);
  const [attendancePresence, setAttendancePresence] = useState(false);
  const [enrollmentSampleCount, setEnrollmentSampleCount] = useState(0);
  const [faceSize, setFaceSize] = useState(0);
  const [facingCenter, setFacingCenter] = useState(false);
  const [faceMesh, setFaceMesh] = useState<FaceMeshPoint[]>([]);
  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 480 });
  const [hasEmbedding, setHasEmbedding] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string | null; employeeId: string } | null>(null);
  const [isResolvingSession, setIsResolvingSession] = useState(true);

  const isEnrollment = mode === "enrollment";
  const activeChallenge = challengeOrder.find((challenge) => !completedChallenges.includes(challenge));
  const allChallengesCompleted = challengeOrder.length > 0 && completedChallenges.length === challengeOrder.length;
  const matchPassed = isEnrollment || identityVerified;
  const qualityPassed = faceCount === 1
    && faceConfidence >= 60
    && faceSize >= MIN_FACE_SIZE_PX
    && facingCenter
    && (livenessScore ?? 0) >= 0.6
    && (antiSpoofScore ?? 0) >= 0.6;
  const canFinalize = scanState === "scanning"
    && allChallengesCompleted
    && hasEmbedding
    && matchPassed
    && (isEnrollment ? qualityPassed && enrollmentSampleCount >= REQUIRED_ENROLLMENT_SAMPLES : attendancePresence);

  const stopCamera = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    isDetectingRef.current = false;
  }, []);

  const updateResult = useCallback((result: HumanResult) => {
    const face = result.face[0];
    const gestureNames = result.gesture.map((entry) => String(entry.gesture));
    const yaw = face?.rotation?.angle.yaw ?? 0;
    const pitch = face?.rotation?.angle.pitch ?? 0;
    const nextFaceSize = Math.min(face?.box?.[2] ?? 0, face?.box?.[3] ?? 0);
    const nextFaceConfidence = Math.round(((face?.faceScore ?? face?.boxScore ?? 0) * 100));
    const nextFacingCenter = gestureNames.includes("facing center") || (Math.abs(yaw) <= CENTER_YAW_THRESHOLD && Math.abs(pitch) <= CENTER_PITCH_THRESHOLD);
    const baseQualityPassed = result.face.length === 1
      && nextFaceConfidence >= 60
      && nextFaceSize >= MIN_FACE_SIZE_PX
      && (face?.live ?? 0) >= 0.6
      && (face?.real ?? 0) >= 0.6;
    const nextQualityPassed = baseQualityPassed && nextFacingCenter;
    setFaceCount(result.face.length);
    setFaceConfidence(nextFaceConfidence);
    setLivenessScore(face?.live);
    setAntiSpoofScore(face?.real);
    setFaceSize(nextFaceSize);
    setFacingCenter(nextFacingCenter);
    if (Date.now() - lastMeshRenderAtRef.current >= 66) {
      setFaceMesh(face?.mesh ?? []);
      lastMeshRenderAtRef.current = Date.now();
    }
    qualityPassedRef.current = nextQualityPassed;
    attendancePresenceRef.current = baseQualityPassed;
    setAttendancePresence(baseQualityPassed);

    if (result.face.length !== 1 || !face?.embedding) {
      latestEmbeddingRef.current = null;
      setHasEmbedding(false);
      setMatchScore(null);
      matchScoreRef.current = null;
      stableMatchFramesRef.current = 0;
      mismatchFramesRef.current = 0;
      similarityWindowRef.current = [];
      identityVerifiedRef.current = false;
      attendancePresenceRef.current = false;
      setStableMatchFrames(0);
      setIdentityVerified(false);
      setAttendancePresence(false);
      setFaceMesh([]);
      return;
    }

    latestEmbeddingRef.current = face.embedding;
    setHasEmbedding(true);

    // Enrollment descriptors are deliberately taken only while the user faces
    // the camera. Liveness poses prove presence, but should not become the
    // reference identity used for normal, straight-on attendance.
    if (
      isEnrollment
      && baseQualityPassed
      && nextFacingCenter
      && enrollmentSamplesRef.current.length < REQUIRED_ENROLLMENT_SAMPLES
      && Date.now() - lastEnrollmentSampleAtRef.current >= ENROLLMENT_SAMPLE_INTERVAL_MS
    ) {
      const nextSamples = [...enrollmentSamplesRef.current, face.embedding];
      enrollmentSamplesRef.current = nextSamples;
      lastEnrollmentSampleAtRef.current = Date.now();
      setEnrollmentSampleCount(nextSamples.length);
    }

    const storedTemplate = templateRef.current;
    if (!isEnrollment && storedTemplate) {
      const rawSimilarity = templateSimilarity(face.embedding, storedTemplate.descriptors);
      const similarityWindow = [...similarityWindowRef.current, rawSimilarity].slice(-SIMILARITY_WINDOW_SIZE);
      similarityWindowRef.current = similarityWindow;
      const smoothedSimilarity = median(similarityWindow);

      if (!identityVerifiedRef.current) {
        const verifiedFrame = nextQualityPassed && smoothedSimilarity >= MIN_IDENTITY_SIMILARITY;
        stableMatchFramesRef.current = verifiedFrame
          ? Math.min(stableMatchFramesRef.current + 1, REQUIRED_STABLE_MATCHES)
          : 0;
        identityVerifiedRef.current = stableMatchFramesRef.current >= REQUIRED_STABLE_MATCHES;
        mismatchFramesRef.current = 0;
      } else if (rawSimilarity < MIN_IDENTITY_SIMILARITY - IDENTITY_RESET_MARGIN) {
        mismatchFramesRef.current += 1;
        if (mismatchFramesRef.current >= REQUIRED_MISMATCH_FRAMES) {
          identityVerifiedRef.current = false;
          stableMatchFramesRef.current = 0;
          mismatchFramesRef.current = 0;
          similarityWindowRef.current = [rawSimilarity];
        }
      } else {
        mismatchFramesRef.current = 0;
      }

      setMatchScore(Math.round(smoothedSimilarity * 100));
      matchScoreRef.current = smoothedSimilarity;
      setStableMatchFrames(stableMatchFramesRef.current);
      setIdentityVerified(identityVerifiedRef.current);
    } else if (!isEnrollment) {
      setMatchScore(null);
      matchScoreRef.current = null;
      stableMatchFramesRef.current = 0;
      mismatchFramesRef.current = 0;
      similarityWindowRef.current = [];
      identityVerifiedRef.current = false;
      setStableMatchFrames(0);
      setIdentityVerified(false);
    }

    const target = challengeOrderRef.current.find((challenge) => !completedChallengesRef.current.includes(challenge));
    if (!target) {
      challengeStartedAtRef.current = null;
      challengeFramesRef.current = 0;
      return;
    }

    // Camera drivers and browser previews do not all report horizontal yaw in
    // the same direction. The first successful horizontal turn calibrates the
    // device; the remaining horizontal challenge must be the opposite turn.
    // This keeps the liveness requirement intact without a brittle left/right
    // convention that can leave users stuck on one instruction.
    const gestureByChallenge: Record<ChallengeId, string> = {
      left: "facing left",
      right: "facing right",
      up: "head up",
      down: "head down",
      blink: "blink",
    };
    const expected = gestureByChallenge[target];
    const gestureDetected = target === "blink"
      ? gestureNames.some((gesture) => gesture.startsWith(expected))
      : target === "left" || target === "right"
        ? false
        : gestureNames.includes(expected);
    const horizontalDirection: HorizontalDirection | null = yaw >= TURN_YAW_THRESHOLD
      ? "positive"
      : yaw <= -TURN_YAW_THRESHOLD
        ? "negative"
        : null;
    const horizontalDetected = target === "left" || target === "right"
      ? (() => {
        if (!horizontalDirection) return false;
        const calibration = horizontalCalibrationRef.current;
        if (!calibration) return true;
        const expectedDirection = target === calibration.firstChallenge
          ? calibration.direction
          : calibration.direction === "positive" ? "negative" : "positive";
        return horizontalDirection === expectedDirection;
      })()
      : false;
    const rotationDetected = target === "left" || target === "right"
      ? horizontalDetected
        : target === "up"
          ? pitch <= -TILT_PITCH_THRESHOLD
          : target === "down"
            ? pitch >= TILT_PITCH_THRESHOLD
            : false;
    const detected = gestureDetected || rotationDetected;

    // The final action still requires liveness/anti-spoof scores. During a
    // head turn those scores can momentarily dip, so they must not freeze the
    // visible liveness progress itself.
    const challengeCanBeCompleted = detected
      && result.face.length === 1
      && nextFaceConfidence >= 60
      && nextFaceSize >= MIN_FACE_SIZE_PX;
    let confirmedChallenge = false;

    if (!challengeCanBeCompleted) {
      challengeStartedAtRef.current = null;
      challengeFramesRef.current = 0;
    } else if (target === "blink") {
      challengeFramesRef.current += 1;
      confirmedChallenge = challengeFramesRef.current >= BLINK_CONFIRMATION_FRAMES;
    } else {
      if (challengeStartedAtRef.current === null) {
        challengeStartedAtRef.current = Date.now();
      }
      confirmedChallenge = Date.now() - challengeStartedAtRef.current >= CHALLENGE_HOLD_DURATION_MS;
    }

    if (confirmedChallenge) {
      if (!completedChallengesRef.current.includes(target)) {
        if ((target === "left" || target === "right") && horizontalDirection && !horizontalCalibrationRef.current) {
          horizontalCalibrationRef.current = { firstChallenge: target, direction: horizontalDirection };
        }
        const nextCompleted = [...completedChallengesRef.current, target];
        completedChallengesRef.current = nextCompleted;
        setCompletedChallenges(nextCompleted);
        challengeStartedAtRef.current = null;
        challengeFramesRef.current = 0;
      }
    }
  }, [isEnrollment]);

  const startDetection = useCallback(() => {
    const loop = async () => {
      const video = videoRef.current;
      if (!video || !humanRef.current || !streamRef.current) return;

      if (!isDetectingRef.current && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        isDetectingRef.current = true;
        try {
          const result = await humanRef.current.detect(video);
          updateResult(result);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Model wajah gagal memproses kamera.";
          setErrorMessage(message);
        } finally {
          isDetectingRef.current = false;
        }
      }
      frameRef.current = window.requestAnimationFrame(loop);
    };
    frameRef.current = window.requestAnimationFrame(loop);
  }, [updateResult]);

  const startScan = useCallback(async () => {
    setErrorMessage("");
    setActionMessage("");
    if (!currentUser) {
      setErrorMessage("Sesi akun tidak ditemukan. Silakan login kembali.");
      router.replace("/login");
      return;
    }
    const nextOrder = shuffleChallenges();
    challengeOrderRef.current = nextOrder;
    completedChallengesRef.current = [];
    setCompletedChallenges([]);
    setChallengeOrder(nextOrder);
    setFaceCount(0);
    setFaceConfidence(0);
    setLivenessScore(undefined);
    setAntiSpoofScore(undefined);
    setMatchScore(null);
    matchScoreRef.current = null;
    setStableMatchFrames(0);
    setIdentityVerified(false);
    setEnrollmentSampleCount(0);
    setFaceSize(0);
    setFacingCenter(false);
    setFaceMesh([]);
    setHasEmbedding(false);
    latestEmbeddingRef.current = null;
    enrollmentSamplesRef.current = [];
    lastEnrollmentSampleAtRef.current = 0;
    stableMatchFramesRef.current = 0;
    mismatchFramesRef.current = 0;
    similarityWindowRef.current = [];
    challengeStartedAtRef.current = null;
    challengeFramesRef.current = 0;
    horizontalCalibrationRef.current = null;
    identityVerifiedRef.current = false;
    qualityPassedRef.current = false;
    attendancePresenceRef.current = false;
    setAttendancePresence(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setScanState("error");
      setErrorMessage("Browser ini tidak mendukung akses kamera.");
      return;
    }

    try {
      setScanState("loading");
      const [{ default: Human }, stream] = await Promise.all([
        import("@vladmandic/human"),
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }),
      ]);

      const humanConfig = {
        backend: "webgl",
        debug: false,
        cacheModels: true,
        modelBasePath: "https://vladmandic.github.io/human-models/models",
        face: {
          enabled: true,
          detector: { enabled: true, rotation: true, maxDetected: 1, minConfidence: 0.6 },
          mesh: { enabled: true },
          iris: { enabled: true },
          description: { enabled: false },
          insightface: {
            enabled: true,
            modelPath: "https://vladmandic.github.io/insightface/models/insightface-mobilenet-swish.json",
            skipFrames: 1,
            skipTime: 0,
          },
          antispoof: { enabled: true },
          liveness: { enabled: true },
        },
        gesture: { enabled: true },
        body: { enabled: false },
        hand: { enabled: false },
        object: { enabled: false },
        segmentation: { enabled: false },
      };
      // InsightFace is supported by Human at runtime but is not declared in its
      // public FaceConfig type, so keep this feature flag outside that narrow type.
      const human = new Human(humanConfig as never) as unknown as HumanInstance;

      humanRef.current = human;
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setVideoDimensions({
          width: videoRef.current.videoWidth || 640,
          height: videoRef.current.videoHeight || 480,
        });
      }
      await human.load();
      setScanState("scanning");
      startDetection();
    } catch (error) {
      stopCamera();
      setScanState("error");
      const message = error instanceof Error ? error.message : "Kamera atau model biometrik tidak dapat dimulai.";
      setErrorMessage(message.includes("Permission") || message.includes("NotAllowed")
        ? "Izin kamera belum diberikan. Izinkan kamera lalu coba kembali."
        : message);
    }
  }, [currentUser, router, startDetection, stopCamera]);

  const resetScan = useCallback(() => {
    stopCamera();
    setScanState("idle");
    challengeOrderRef.current = [];
    completedChallengesRef.current = [];
    setCompletedChallenges([]);
    setChallengeOrder([]);
    setFaceCount(0);
    setFaceConfidence(0);
    setLivenessScore(undefined);
    setAntiSpoofScore(undefined);
    setMatchScore(null);
    matchScoreRef.current = null;
    setStableMatchFrames(0);
    setIdentityVerified(false);
    setEnrollmentSampleCount(0);
    setFaceSize(0);
    setFacingCenter(false);
    setFaceMesh([]);
    setHasEmbedding(false);
    latestEmbeddingRef.current = null;
    enrollmentSamplesRef.current = [];
    lastEnrollmentSampleAtRef.current = 0;
    stableMatchFramesRef.current = 0;
    mismatchFramesRef.current = 0;
    similarityWindowRef.current = [];
    challengeStartedAtRef.current = null;
    challengeFramesRef.current = 0;
    horizontalCalibrationRef.current = null;
    identityVerifiedRef.current = false;
    qualityPassedRef.current = false;
    attendancePresenceRef.current = false;
    setAttendancePresence(false);
  }, [stopCamera]);

  const saveEnrollment = useCallback(async () => {
    if (!humanRef.current || enrollmentSamplesRef.current.length < REQUIRED_ENROLLMENT_SAMPLES || !qualityPassedRef.current || completedChallengesRef.current.length !== challengeOrderRef.current.length) {
      setErrorMessage(`Pendaftaran belum cukup kuat. Selesaikan lima gerakan, lalu kembali hadap kamera sampai ${REQUIRED_ENROLLMENT_SAMPLES} sampel wajah tengah terkumpul.`);
      return;
    }
    const nextTemplate: FaceTemplate = {
      descriptors: enrollmentSamplesRef.current,
      createdAt: new Date().toISOString(),
      modelVersion: humanRef.current.version,
      embeddingModel: "insightface-mobilenet-swish",
    };
    if (!currentUser) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("d3_face_biometric_templates")
      .upsert({
        employee_id: currentUser.employeeId,
        auth_user_id: currentUser.id,
        embedding_model: nextTemplate.embeddingModel,
        embedding_version: 2,
        descriptors: nextTemplate.descriptors,
        enrollment_quality: {
          face_confidence: faceConfidence,
          liveness_score: livenessScore ?? null,
          anti_spoof_score: antiSpoofScore ?? null,
          sample_count: nextTemplate.descriptors.length,
        },
        enrolled_at: nextTemplate.createdAt,
        updated_at: nextTemplate.createdAt,
      }, { onConflict: "employee_id" });

    if (error) {
      setErrorMessage(error.code === "42501"
        ? "Akun ini belum memiliki akses employee yang sesuai untuk menyimpan biometrik."
        : "Template biometrik belum dapat disimpan. Periksa koneksi lalu coba kembali.");
      return;
    }

    templateRef.current = nextTemplate;
    setTemplate(nextTemplate);
    setScanState("complete");
    setActionMessage("Template biometrik tersimpan dan terikat ke akun karyawan ini.");
    stopCamera();
  }, [antiSpoofScore, currentUser, faceConfidence, livenessScore, stopCamera]);

  const recordAttendance = useCallback(async () => {
    if (!identityVerifiedRef.current || !attendancePresenceRef.current || completedChallengesRef.current.length !== challengeOrderRef.current.length) {
      setErrorMessage("Identitas belum tervalidasi stabil. Pastikan satu wajah hidup yang terdaftar masih terlihat, lalu selesaikan Liveness Checking.");
      return;
    }
    if (!currentUser || matchScoreRef.current === null) return;
    const supabase = createClient();
    const recordedAt = new Date().toISOString();
    const attendanceDate = getJakartaDate();
    const { data: existingAttendance, error: lookupError } = await supabase
      .from("d3_attendances")
      .select("id, clock_in, clock_out")
      .eq("employee_id", currentUser.employeeId)
      .eq("date", attendanceDate)
      .maybeSingle();

    if (lookupError) {
      setErrorMessage("Riwayat attendance belum dapat diperiksa. Periksa koneksi lalu coba kembali.");
      return;
    }

    let type: "CLOCK_IN" | "CLOCK_OUT";
    if (!existingAttendance) {
      type = "CLOCK_IN";
      const { error } = await supabase
        .from("d3_attendances")
        .insert({
          employee_id: currentUser.employeeId,
          date: attendanceDate,
          clock_in: recordedAt,
          status: "PRESENT",
          notes: "Face biometric verification",
        });
      if (error) {
        setErrorMessage("Clock-in belum dapat dicatat ke Attendance History. Periksa koneksi lalu coba kembali.");
        return;
      }
    } else {
      const todayAttendance = existingAttendance as DailyAttendance;
      if (todayAttendance.clock_out) {
        setErrorMessage("Clock-in dan clock-out hari ini sudah tercatat di Attendance History.");
        return;
      }
      type = "CLOCK_OUT";
      const { error } = await supabase
        .from("d3_attendances")
        .update({ clock_out: recordedAt })
        .eq("id", todayAttendance.id);
      if (error) {
        setErrorMessage("Clock-out belum dapat diperbarui di Attendance History. Periksa koneksi lalu coba kembali.");
        return;
      }
    }

    // This is an audit trail for the biometric verification. The attendance
    // source of truth remains d3_attendances, owned by the attendance feature.
    const { error: eventError } = await supabase
      .from("d3_face_biometric_events")
      .insert({
        employee_id: currentUser.employeeId,
        auth_user_id: currentUser.id,
        event_type: type,
        similarity: matchScoreRef.current,
        liveness_score: livenessScore ?? null,
        anti_spoof_score: antiSpoofScore ?? null,
      });

    setScanState("complete");
    setActionMessage(`${type === "CLOCK_IN" ? "Clock-in" : "Clock-out"} berhasil dicatat di Attendance History & Correction.${eventError ? " Audit biometrik belum tersimpan, tetapi data presensi sudah tercatat." : ""}`);
    stopCamera();
    window.setTimeout(() => router.push("/attendance"), 900);
  }, [antiSpoofScore, currentUser, livenessScore, router, stopCamera]);

  useEffect(() => {
    let isMounted = true;

    async function loadCurrentUser() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          router.replace("/login");
          return;
        }
        const { data: access, error: accessError } = await supabase
          .from("d3_user_access")
          .select("employee_id")
          .eq("auth_user_id", data.user.id)
          .maybeSingle();
        if (accessError || !access) {
          if (isMounted) setErrorMessage("Akun ini belum dipetakan ke data employee HRMS. Hubungi HR Admin.");
          return;
        }

        const user = { id: data.user.id, email: data.user.email ?? null, employeeId: access.employee_id };
        const { data: storedTemplate, error: templateError } = await supabase
          .from("d3_face_biometric_templates")
          .select("descriptors, enrolled_at, embedding_model")
          .eq("auth_user_id", user.id)
          .maybeSingle();
        if (templateError && templateError.code !== "PGRST116") {
          if (isMounted) setErrorMessage("Template biometrik belum dapat dimuat. Periksa koneksi lalu coba kembali.");
          return;
        }

        if (!isMounted) return;
        setCurrentUser(user);
        if (storedTemplate && Array.isArray(storedTemplate.descriptors)) {
          const loadedTemplate: FaceTemplate = {
            descriptors: storedTemplate.descriptors as number[][],
            createdAt: storedTemplate.enrolled_at,
            modelVersion: "InsightFace",
            embeddingModel: storedTemplate.embedding_model as FaceTemplate["embeddingModel"],
          };
          templateRef.current = loadedTemplate;
          setTemplate(loadedTemplate);
        }
      } catch {
        if (isMounted) setErrorMessage("Sesi login belum siap. Periksa koneksi Supabase lalu login kembali.");
      } finally {
        if (isMounted) setIsResolvingSession(false);
      }
    }

    void loadCurrentUser();
    return () => { isMounted = false; };
  }, [router]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const statusItems = useMemo(() => [
    { label: "Satu wajah", value: faceCount === 1 ? "Terdeteksi" : faceCount === 0 ? "Menunggu" : "Terlalu banyak wajah", valid: faceCount === 1 },
    { label: "Kualitas wajah", value: faceConfidence > 0 ? `${faceConfidence}%` : "Menunggu", valid: faceConfidence >= 60 },
    { label: "Ukuran wajah", value: faceSize > 0 ? `${faceSize}px` : "Menunggu", valid: faceSize >= MIN_FACE_SIZE_PX },
    { label: "Hadap kamera", value: facingCenter ? "Terpusat" : "Kembali ke tengah", valid: facingCenter },
    { label: "Liveness", value: livenessLabel(livenessScore), valid: typeof livenessScore === "number" && livenessScore >= 0.6 },
    { label: "Anti-spoof", value: typeof antiSpoofScore === "number" ? `${Math.round(antiSpoofScore * 100)}%` : "Menunggu", valid: typeof antiSpoofScore === "number" && antiSpoofScore >= 0.6 },
    ...(isEnrollment
      ? [{ label: "Sampel wajah tengah", value: `${enrollmentSampleCount}/${REQUIRED_ENROLLMENT_SAMPLES}`, valid: enrollmentSampleCount >= REQUIRED_ENROLLMENT_SAMPLES }]
      : [{ label: "Identitas wajah", value: matchScore === null ? "Menunggu" : identityVerified ? `Terverifikasi • ${matchScore}%` : `${matchScore}% • ${stableMatchFrames}/${REQUIRED_STABLE_MATCHES} frame`, valid: identityVerified }]),
  ], [antiSpoofScore, enrollmentSampleCount, faceConfidence, faceCount, faceSize, facingCenter, identityVerified, isEnrollment, livenessScore, matchScore, stableMatchFrames]);

  const title = isEnrollment ? "Biometric Registration" : "Face Biometric Attendance";
  const subtitle = isEnrollment
    ? "Daftarkan template wajah milikmu dengan tantangan liveness."
    : "Verifikasi wajah dan liveness sebelum mencatat clock-in atau clock-out.";

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-[#172033]">
      <style>{`
        @keyframes biometric-scan-sweep {
          0%, 100% { top: 10%; opacity: 0.35; }
          50% { top: 88%; opacity: 1; }
        }
      `}</style>
      <header className="sticky top-0 z-20 flex h-16 items-center border-b border-[#dde5f1] bg-white px-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-6">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6c7c97]">HRMS / D3</p>
            <h1 className="truncate text-base font-bold text-[#172033]">{title}</h1>
          </div>
          <HeaderAccount />
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-[#dbe6f7] bg-white p-5 shadow-[0_4px_18px_rgba(27,53,102,0.06)] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between xl:items-center">
            <div className="max-w-2xl">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#1971c2]">Secure identity scan</p>
              <h2 className="text-xl font-bold tracking-[-0.35px] text-[#172033] sm:text-2xl">{isEnrollment ? "Daftarkan wajahmu sekali, dari akunmu sendiri." : "Clock-in dengan verifikasi wajah dan gerakan hidup."}</h2>
              <p className="mt-2 text-sm leading-6 text-[#60708d]">{subtitle}</p>
            </div>
          </div>
        </section>

        {actionMessage && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800"><CheckCircle2 size={17} className="mt-0.5 shrink-0" />{actionMessage}</div>
        )}
        {errorMessage && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700"><CircleAlert size={17} className="mt-0.5 shrink-0" />{errorMessage}</div>
        )}

        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="overflow-hidden rounded-2xl border border-[#dbe4f0] bg-white shadow-[0_4px_18px_rgba(27,53,102,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7edf5] px-5 py-4">
              <div><h3 className="text-sm font-bold text-[#172033]">Kamera verifikasi</h3><p className="mt-0.5 text-xs text-[#60708d]">Pastikan wajah terlihat jelas dan hanya ada satu orang di kamera.</p></div>
              <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${scanState === "scanning" ? "bg-[#e9f3ff] text-[#1971c2]" : scanState === "error" ? "bg-red-50 text-red-600" : "bg-[#f1f5fa] text-[#60708d]"}`}>{scanState === "scanning" ? "MEMINDAI" : scanState === "loading" ? "MENYIAPKAN MODEL" : scanState === "complete" ? "SELESAI" : "SIAP"}</span>
            </div>

            <div className="relative mx-auto aspect-square w-full max-w-[500px] p-7 sm:p-10">
              <div className="absolute inset-3 rounded-full border border-[#307ee7]/25 shadow-[0_0_44px_rgba(42,120,230,0.18)]" />
              <div className="absolute inset-7 rounded-[46%] border border-[#65b5ff]/55" />
              <div className="relative size-full overflow-hidden rounded-[46%] border-2 border-[#77c0ff]/65 bg-[#071225] shadow-[0_0_0_10px_rgba(36,113,213,0.08),0_0_50px_rgba(29,115,227,0.25)]">
              <video ref={videoRef} muted playsInline className={`size-full origin-center scale-x-[-1] object-cover transition duration-500 ${scanState === "scanning" ? "opacity-100" : "opacity-25"}`} />
              {scanState !== "scanning" && (
                <div className="absolute inset-0 grid place-items-center p-6 text-center text-[#d9e2fc]">
                  <div><div className="mx-auto grid size-14 place-items-center rounded-full border border-white/20 bg-white/10"><Video size={25} /></div><p className="mt-3 text-sm font-bold">Kamera belum aktif</p><p className="mt-1 text-xs text-[#d9e2fc]/70">Tekan mulai untuk memberi izin kamera dan memuat model.</p></div>
                </div>
              )}
              {scanState === "scanning" && <>
                <div className="pointer-events-none absolute inset-[9%] rounded-[46%] border-2 border-[#73c0ff] shadow-[0_0_22px_rgba(71,166,255,0.85)]" />
                {faceMesh.length > 0 && <svg className="pointer-events-none absolute inset-0 size-full origin-center scale-x-[-1]" viewBox={`0 0 ${videoDimensions.width} ${videoDimensions.height}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                  <g fill="none" stroke="#8ee7ff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.9">
                    {FACE_OVERLAY_PATHS.map((path, index) => {
                      const points = path.map((pointIndex) => faceMesh[pointIndex]).filter((point): point is FaceMeshPoint => Boolean(point));
                      return points.length > 1 ? <polyline key={index} points={points.map((point) => `${point.x},${point.y}`).join(" ")} /> : null;
                    })}
                  </g>
                  <g fill="#d6f7ff" opacity="0.82">
                    {faceMesh.filter((_, index) => index % 6 === 0).map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="1.3" />)}
                  </g>
                </svg>}
                <div className="pointer-events-none absolute inset-x-[14%] h-px bg-[#c4ecff] shadow-[0_0_18px_4px_rgba(83,184,255,0.85)]" style={{ animation: "biometric-scan-sweep 2.15s ease-in-out infinite" }} />
                <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-[#061326]/75 px-3 py-1 text-[9px] font-bold tracking-[0.14em] text-[#dcefff]">FACE LOCK</div>
              </>}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-[#e7edf5] p-5">
              {scanState === "loading" || isResolvingSession ? (
                <button disabled className="inline-flex items-center gap-2 rounded-lg bg-[#0f2342] px-4 py-2.5 text-xs font-bold text-white opacity-75"><LoaderCircle size={16} className="animate-spin" /> Menyiapkan kamera & model…</button>
              ) : scanState === "scanning" ? (
                <button type="button" onClick={resetScan} className="inline-flex items-center gap-2 rounded-lg border border-[#d64545]/25 bg-red-50 px-4 py-2.5 text-xs font-bold text-[#b4232b] transition hover:bg-red-100"><VideoOff size={16} /> Batalkan pemindaian</button>
              ) : (
                <button type="button" onClick={() => void startScan()} className="inline-flex items-center gap-2 rounded-lg bg-[#006838] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#005b30]"><Video size={16} /> {scanState === "complete" ? "Mulai pemindaian baru" : "Mulai kamera"}</button>
              )}
              {!isEnrollment && !template && <Link href="/biometric-enrollment" className="text-xs font-semibold text-[#1971c2] underline underline-offset-4">Belum ada template untuk akun ini. Daftarkan biometrik.</Link>}
            </div>
          </section>

          <aside className="space-y-5">
            <section className="rounded-2xl border border-[#dbe4f0] bg-white p-5 shadow-[0_4px_18px_rgba(27,53,102,0.06)]">
              <div className="flex items-center justify-between"><h3 className="text-sm font-bold">Liveness Checking</h3><span className="text-xs font-bold text-[#1971c2]">{completedChallenges.length}/{challengeOrder.length || 5}</span></div>
              <p className="mt-1 text-xs leading-5 text-[#4d5f81] xl:leading-4">Selesaikan seluruh gerakan secara berurutan untuk melanjutkan.</p>
              <div className="mt-4 space-y-2">
                {(challengeOrder.length ? challengeOrder : (["left", "right", "up", "down", "blink"] as ChallengeId[])).map((challenge, index) => {
                  const completed = completedChallenges.includes(challenge);
                  const active = activeChallenge === challenge && scanState === "scanning";
                  return <div key={challenge} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${completed ? "border-emerald-200 bg-emerald-50" : active ? "border-[#b9d6ff] bg-[#edf6ff]" : "border-slate-100 bg-[#f7f8ff]"}`}><span className={`grid size-6 place-items-center rounded-full text-[10px] font-bold ${completed ? "bg-[#16834b] text-white" : active ? "bg-[#1971c2] text-white" : "bg-white text-[#4d5f81]"}`}>{completed ? <Check size={14} /> : index + 1}</span><div><p className="text-xs font-bold">{challengeDetails[challenge].label}</p><p className="text-[10px] text-[#4d5f81]">{challengeDetails[challenge].helper}</p></div></div>;
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-[#dbe4f0] bg-white p-5 shadow-[0_4px_18px_rgba(27,53,102,0.06)]">
              <h3 className="text-sm font-bold">Status verifikasi</h3>
              <div className="mt-3 space-y-2.5">{statusItems.map((item) => <div key={item.label} className="flex items-center justify-between gap-3 text-xs"><span className="text-[#4d5f81]">{item.label}</span><span className={`inline-flex items-center gap-1 font-bold ${item.valid ? "text-[#006838]" : "text-[#b7791f]"}`}>{item.valid ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}{item.value}</span></div>)}</div>
            </section>
          </aside>
        </div>

        <section className="mt-5 rounded-2xl border border-[#dbe4f0] bg-white p-5 shadow-[0_4px_18px_rgba(27,53,102,0.06)]">
          {isEnrollment ? (
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h3 className="text-sm font-bold">Simpan template biometrik</h3><p className="mt-1 text-xs leading-5 text-[#4d5f81]">Selesaikan lima Liveness Checking, lalu hadap kamera sampai {REQUIRED_ENROLLMENT_SAMPLES} sampel wajah tengah terkumpul.</p>{currentUser?.email && <p className="mt-1 text-[11px] font-semibold text-[#1971c2]">Dipetakan ke akun: {currentUser.email}</p>}{template && <p className="mt-2 text-[11px] font-semibold text-[#006838]">Template terakhir: {formatTime(template.createdAt)} • Human {template.modelVersion}</p>}</div><button type="button" disabled={!canFinalize} onClick={() => void saveEnrollment()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#006838] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#005b30] disabled:cursor-not-allowed disabled:bg-slate-300"><UserRoundCheck size={16} /> Simpan template</button></div>
          ) : (
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h3 className="text-sm font-bold">Simpan ke Attendance History</h3><p className="mt-1 text-xs leading-5 text-[#4d5f81]">Setelah identitas dan liveness terverifikasi, clock-in atau clock-out akan dicatat pada fitur Attendance History & Correction.</p><p className="mt-1 text-[11px] font-semibold text-[#1971c2]">Identitas harus cocok minimal {Math.round(MIN_IDENTITY_SIMILARITY * 100)}% selama {REQUIRED_STABLE_MATCHES} frame stabil. Setelah terverifikasi, gerakan kecil tidak langsung membatalkan tombol.</p></div><button type="button" disabled={!canFinalize || !template} onClick={() => void recordAttendance()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#006838] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#005b30] disabled:cursor-not-allowed disabled:bg-slate-300"><Clock3 size={16} /> Catat ke Attendance History</button></div>
          )}
        </section>

        <p className="mt-5 flex items-start gap-2 text-[11px] leading-5 text-[#4d5f81]"><Eye size={14} className="mt-0.5 shrink-0" /> Eksperimen ini bukan alat absensi produksi dan tidak menggantikan kebijakan HR. Hasil dapat dipengaruhi kualitas kamera, pencahayaan, serta kemampuan model.</p>
      </div>
    </main>
  );
}
