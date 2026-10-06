"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  Eye,
  LoaderCircle,
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
  warmup?: () => Promise<unknown>;
  detect: (input: HTMLVideoElement) => Promise<HumanResult>;
};

type CapturedFaceSample = { blob: Blob; descriptor: number[] };

type FaceTemplate = {
  descriptors: number[][];
  createdAt: string;
  modelVersion: string;
  embeddingModel: "insightface-mobilenet-swish" | "face-api-js-face-recognition-net";
  samplePaths: string[];
};

type DailyAttendance = {
  id: string;
  clock_in: string;
  clock_out: string | null;
};

// Cosine similarity for the InsightFace embedding. This is a provisional
// security threshold and must be calibrated with genuine and impostor tests.
const MIN_IDENTITY_SIMILARITY = 0.7;
const FAST_IDENTITY_SIMILARITY = 0.82;
const REQUIRED_STABLE_MATCHES = 5;
const FAST_REQUIRED_STABLE_MATCHES = 3;
const SIMILARITY_WINDOW_SIZE = 5;
const CHALLENGE_HOLD_DURATION_MS = 450;
const BLINK_CONFIRMATION_FRAMES = 2;
const ENROLLMENT_CENTER_HOLD_MS = 1500;
const FACE_SAMPLE_CAPTURE_INTERVAL_MS = 1000;
const REQUIRED_FACE_SAMPLES = 5;
const TEMPLATE_TOP_MATCHES = 5;
const REQUIRED_LIVENESS_CHALLENGES = 3;
const MIN_ENROLLMENT_SAMPLE_SIMILARITY = 0.82;
const ATTENDANCE_VERIFICATION_TIMEOUT_MS = 15000;

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
const TURN_YAW_THRESHOLD = degreesToRadians(12);
const TILT_PITCH_THRESHOLD = degreesToRadians(10);

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
  return values.slice(0, REQUIRED_LIVENESS_CHALLENGES);
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
  const scores = descriptors
    .filter((descriptor) => descriptor.length === embedding.length)
    .map((descriptor) => cosineSimilarity(embedding, descriptor))
    .sort((first, second) => second - first);
  if (scores.length === 0) return 0;

  // A template may contain samples captured in more than one good-quality
  // session. Averaging every descriptor lets an old camera, lighting, or pose
  // outlier pull the entire reference down. Requiring the mean of the five
  // closest stored samples remains stricter than accepting one best frame.
  const nearest = scores.slice(0, Math.min(TEMPLATE_TOP_MATCHES, scores.length));
  return nearest.reduce((total, score) => total + score, 0) / nearest.length;
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
  const faceSamplePhotosRef = useRef<CapturedFaceSample[]>([]);
  const faceSampleCapturePendingRef = useRef(false);
  const lastFaceSampleCaptureAtRef = useRef(0);
  const facingCenterSinceRef = useRef<number | null>(null);
  const lastMeshRenderAtRef = useRef(0);
  const challengeOrderRef = useRef<ChallengeId[]>([]);
  const completedChallengesRef = useRef<ChallengeId[]>([]);
  const horizontalCalibrationRef = useRef<{ firstChallenge: "left" | "right"; direction: HorizontalDirection } | null>(null);
  const challengeStartedAtRef = useRef<number | null>(null);
  const challengeFramesRef = useRef(0);
  const stableMatchFramesRef = useRef(0);
  const mismatchFramesRef = useRef(0);
  const attendanceVerificationStartedAtRef = useRef<number | null>(null);
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
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [stableMatchFrames, setStableMatchFrames] = useState(0);
  const [identityVerified, setIdentityVerified] = useState(false);
  const [attendancePresence, setAttendancePresence] = useState(false);
  const [faceSampleCount, setFaceSampleCount] = useState(0);
  const [facingCenter, setFacingCenter] = useState(false);
  const [faceMesh, setFaceMesh] = useState<FaceMeshPoint[]>([]);
  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 480 });
  const [hasEmbedding, setHasEmbedding] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string | null; employeeId: string } | null>(null);
  const [isResolvingSession, setIsResolvingSession] = useState(true);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [savingStage, setSavingStage] = useState("");
  const [isAttendanceRejected, setIsAttendanceRejected] = useState(false);

  const isEnrollment = mode === "enrollment";
  const activeChallenge = challengeOrder.find((challenge) => !completedChallenges.includes(challenge));
  const allChallengesCompleted = challengeOrder.length > 0 && completedChallenges.length === challengeOrder.length;
  const matchPassed = isEnrollment || identityVerified;
  const qualityPassed = faceCount === 1
    && faceConfidence >= 60
    && facingCenter
    && (livenessScore ?? 0) >= 0.6;
  const canFinalize = scanState === "scanning"
    && allChallengesCompleted
    && hasEmbedding
    && matchPassed
    && (isEnrollment ? qualityPassed && faceSampleCount >= REQUIRED_FACE_SAMPLES : attendancePresence);

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

  const captureFaceSample = useCallback((video: HTMLVideoElement, box: HumanFace["box"], descriptor: number[]) => {
    if (!box || faceSampleCapturePendingRef.current || faceSamplePhotosRef.current.length >= REQUIRED_FACE_SAMPLES) return;
    const now = Date.now();
    if (now - lastFaceSampleCaptureAtRef.current < FACE_SAMPLE_CAPTURE_INTERVAL_MS) return;

    // A registration template must represent one stable face. The first
    // frame becomes the reference, then every later sample is accepted only
    // when it closely matches the already accepted samples. This filters out
    // temporary blur and pose changes without weakening attendance matching.
    const acceptedDescriptors = faceSamplePhotosRef.current.map((sample) => sample.descriptor);
    if (acceptedDescriptors.length > 0) {
      const nearestSimilarities = acceptedDescriptors
        .map((accepted) => cosineSimilarity(descriptor, accepted))
        .sort((first, second) => second - first)
        .slice(0, Math.min(2, acceptedDescriptors.length));
      const consistency = nearestSimilarities.reduce((sum, value) => sum + value, 0) / nearestSimilarities.length;
      if (consistency < MIN_ENROLLMENT_SAMPLE_SIMILARITY) return;
    }

    const [x, y, width, height] = box;
    const sourceWidth = video.videoWidth || 640;
    const sourceHeight = video.videoHeight || 480;
    const side = Math.min(Math.max(width, height) * 1.75, sourceWidth, sourceHeight);
    const sourceX = Math.max(0, Math.min(sourceWidth - side, x + width / 2 - side / 2));
    const sourceY = Math.max(0, Math.min(sourceHeight - side, y + height / 2 - side / 2));
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 320;
    canvas.getContext("2d")?.drawImage(video, sourceX, sourceY, side, side, 0, 0, 320, 320);

    faceSampleCapturePendingRef.current = true;
    lastFaceSampleCaptureAtRef.current = now;
    canvas.toBlob((blob) => {
      faceSampleCapturePendingRef.current = false;
      if (!blob || faceSamplePhotosRef.current.length >= REQUIRED_FACE_SAMPLES) return;
      faceSamplePhotosRef.current = [...faceSamplePhotosRef.current, { blob, descriptor: [...descriptor] }];
      setFaceSampleCount(faceSamplePhotosRef.current.length);
    }, "image/webp", 0.9);
  }, []);

  const updateResult = useCallback((result: HumanResult) => {
    const now = Date.now();
    const face = result.face[0];
    const gestureNames = result.gesture.map((entry) => String(entry.gesture));
    const yaw = face?.rotation?.angle.yaw ?? 0;
    const pitch = face?.rotation?.angle.pitch ?? 0;
    const nextFaceConfidence = Math.round(((face?.faceScore ?? face?.boxScore ?? 0) * 100));
    const nextFacingCenter = gestureNames.includes("facing center") || (Math.abs(yaw) <= CENTER_YAW_THRESHOLD && Math.abs(pitch) <= CENTER_PITCH_THRESHOLD);
    const baseQualityPassed = result.face.length === 1
      && nextFaceConfidence >= 60
      && (face?.live ?? 0) >= 0.6;
    const nextQualityPassed = baseQualityPassed && nextFacingCenter;
    setFaceCount(result.face.length);
    setFaceConfidence(nextFaceConfidence);
    setLivenessScore(face?.live);
    setFacingCenter(nextFacingCenter);
    if (Date.now() - lastMeshRenderAtRef.current >= 66) {
      setFaceMesh(face?.mesh ?? []);
      lastMeshRenderAtRef.current = Date.now();
    }
    qualityPassedRef.current = nextQualityPassed;
    attendancePresenceRef.current = baseQualityPassed;
    setAttendancePresence(baseQualityPassed);

    if (result.face.length !== 1 || !face?.embedding) {
      facingCenterSinceRef.current = null;
      latestEmbeddingRef.current = null;
      setHasEmbedding(false);
      if (!identityVerifiedRef.current) {
        setMatchScore(null);
        matchScoreRef.current = null;
      }
      if (!identityVerifiedRef.current) {
        stableMatchFramesRef.current = 0;
        mismatchFramesRef.current = 0;
        similarityWindowRef.current = [];
      }
      attendancePresenceRef.current = false;
      if (!identityVerifiedRef.current) {
        setStableMatchFrames(0);
        setIdentityVerified(false);
      }
      setAttendancePresence(false);
      setFaceMesh([]);
      return;
    }

    latestEmbeddingRef.current = face.embedding;
    setHasEmbedding(true);

    if (baseQualityPassed && nextFacingCenter) {
      facingCenterSinceRef.current ??= now;
    } else {
      facingCenterSinceRef.current = null;
    }

    const livenessFinished = challengeOrderRef.current.length > 0
      && completedChallengesRef.current.length === challengeOrderRef.current.length;

    const storedTemplate = templateRef.current;

    // The five samples are captured automatically only after liveness has
    // completed and the user has returned to a stable, forward-facing pose.
    if (
      isEnrollment
      && baseQualityPassed
      && nextFacingCenter
      && livenessFinished
      && facingCenterSinceRef.current !== null
      && now - facingCenterSinceRef.current >= ENROLLMENT_CENTER_HOLD_MS
      && faceSamplePhotosRef.current.length < REQUIRED_FACE_SAMPLES
    ) {
      const video = videoRef.current;
      if (video) captureFaceSample(video, face.box, face.embedding);
    }

    if (!isEnrollment && storedTemplate?.embeddingModel === "face-api-js-face-recognition-net") {
      setErrorMessage("Template lama perlu didaftarkan ulang agar cocok dengan mesin pengenalan wajah saat ini.");
      setMatchScore(null);
      identityVerifiedRef.current = false;
      setIdentityVerified(false);
    } else if (!isEnrollment && storedTemplate) {
      const rawSimilarity = templateSimilarity(face.embedding, storedTemplate.descriptors);
      const verificationThreshold = MIN_IDENTITY_SIMILARITY;
      const fastVerificationThreshold = FAST_IDENTITY_SIMILARITY;
      const similarityWindow = [...similarityWindowRef.current, rawSimilarity].slice(-SIMILARITY_WINDOW_SIZE);
      similarityWindowRef.current = similarityWindow;
      const smoothedSimilarity = median(similarityWindow);

      const wasVerified = identityVerifiedRef.current;
      if (!wasVerified) {
        const verifiedFrame = nextQualityPassed && smoothedSimilarity >= verificationThreshold;
        stableMatchFramesRef.current = verifiedFrame
          ? Math.min(stableMatchFramesRef.current + 1, REQUIRED_STABLE_MATCHES)
          : 0;
        const requiredFrames = smoothedSimilarity >= fastVerificationThreshold
          ? FAST_REQUIRED_STABLE_MATCHES
          : REQUIRED_STABLE_MATCHES;
        identityVerifiedRef.current = stableMatchFramesRef.current >= requiredFrames;
        mismatchFramesRef.current = 0;
      } else {
        // Verification is intentionally locked for this scan after a stable
        // match. A transient camera frame must not make a verified user start
        // over; attendance still requires one live face at button press.
        mismatchFramesRef.current = 0;
      }

      if (!wasVerified) {
        setMatchScore(Math.round(smoothedSimilarity * 100));
        matchScoreRef.current = smoothedSimilarity;
        setStableMatchFrames(stableMatchFramesRef.current);
        setIdentityVerified(identityVerifiedRef.current);
      }
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

    if (!isEnrollment && livenessFinished && storedTemplate && !identityVerifiedRef.current) {
      attendanceVerificationStartedAtRef.current ??= now;
      if (now - attendanceVerificationStartedAtRef.current >= ATTENDANCE_VERIFICATION_TIMEOUT_MS) {
        setErrorMessage("Wajah tidak terverifikasi untuk akun ini. Pemindaian dihentikan; coba kembali dengan pemilik akun.");
        setIsAttendanceRejected(true);
        setScanState("error");
        stopCamera();
        return;
      }
    } else if (!isEnrollment && identityVerifiedRef.current) {
      attendanceVerificationStartedAtRef.current = null;
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

    // Liveness challenges verify visible motion. During a head turn the model
    // can briefly lose face detail, so challenge progress only requires a
    // single detected face and sufficient detector confidence.
    const challengeCanBeCompleted = detected
      && result.face.length === 1
      && nextFaceConfidence >= 60;
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
  }, [captureFaceSample, isEnrollment, stopCamera]);

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
    setIsAttendanceRejected(false);
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
    setMatchScore(null);
    matchScoreRef.current = null;
    setStableMatchFrames(0);
    setIdentityVerified(false);
    setFaceSampleCount(0);
    setFacingCenter(false);
    setFaceMesh([]);
    setHasEmbedding(false);
    latestEmbeddingRef.current = null;
    faceSamplePhotosRef.current = [];
    faceSampleCapturePendingRef.current = false;
    lastFaceSampleCaptureAtRef.current = 0;
    facingCenterSinceRef.current = null;
    stableMatchFramesRef.current = 0;
    mismatchFramesRef.current = 0;
    similarityWindowRef.current = [];
    challengeStartedAtRef.current = null;
    challengeFramesRef.current = 0;
    horizontalCalibrationRef.current = null;
    attendanceVerificationStartedAtRef.current = null;
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
          filter: { enabled: true, equalization: true },
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
          antispoof: { enabled: false },
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
      await Promise.all([
        human.load(),
        Promise.resolve(human.warmup?.()),
      ]);
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
    setIsAttendanceRejected(false);
    challengeOrderRef.current = [];
    completedChallengesRef.current = [];
    setCompletedChallenges([]);
    setChallengeOrder([]);
    setFaceCount(0);
    setFaceConfidence(0);
    setLivenessScore(undefined);
    setMatchScore(null);
    matchScoreRef.current = null;
    setStableMatchFrames(0);
    setIdentityVerified(false);
    setFaceSampleCount(0);
    setFacingCenter(false);
    setFaceMesh([]);
    setHasEmbedding(false);
    latestEmbeddingRef.current = null;
    faceSamplePhotosRef.current = [];
    faceSampleCapturePendingRef.current = false;
    lastFaceSampleCaptureAtRef.current = 0;
    facingCenterSinceRef.current = null;
    stableMatchFramesRef.current = 0;
    mismatchFramesRef.current = 0;
    similarityWindowRef.current = [];
    challengeStartedAtRef.current = null;
    challengeFramesRef.current = 0;
    horizontalCalibrationRef.current = null;
    attendanceVerificationStartedAtRef.current = null;
    identityVerifiedRef.current = false;
    qualityPassedRef.current = false;
    attendancePresenceRef.current = false;
    setAttendancePresence(false);
  }, [stopCamera]);

  const saveEnrollment = useCallback(async () => {
    if (!currentUser) return;
    if (faceSamplePhotosRef.current.length < REQUIRED_FACE_SAMPLES || !qualityPassedRef.current || completedChallengesRef.current.length !== challengeOrderRef.current.length) {
      setErrorMessage(`Selesaikan liveness lalu hadap lurus ke kamera sampai ${REQUIRED_FACE_SAMPLES} sampel wajah otomatis terkumpul.`);
      return;
    }
    setIsSavingTemplate(true);
    setSavingStage("Memastikan sesi akun…");
    setErrorMessage("");
    const supabase = createClient();
    try {
      const samples = faceSamplePhotosRef.current;
      const descriptors = samples.map((sample) => sample.descriptor);

      if (descriptors.length !== REQUIRED_FACE_SAMPLES || descriptors.some((descriptor) => descriptor.length === 0)) {
        setErrorMessage("Salah satu sampel wajah tidak dapat diproses. Mulai pemindaian baru lalu coba kembali.");
        return;
      }

      const { data: { user: sessionUser }, error: sessionError } = await supabase.auth.getUser();
      if (sessionError || sessionUser?.id !== currentUser.id) {
        setErrorMessage("Sesi login tidak cocok untuk menyimpan sampel wajah. Login ulang lalu coba lagi.");
        return;
      }

      // Store every enrollment in a new private folder. This avoids partially
      // overwriting a previous template when a network request is interrupted.
      const enrollmentId = crypto.randomUUID();
      const samplePaths = samples.map((_, index) => `${currentUser.id}/${enrollmentId}/sample-${index + 1}.webp`);
      const uploadedPaths: string[] = [];
      for (let index = 0; index < samplePaths.length; index += 1) {
        setSavingStage(`Menyimpan sampel wajah ${index + 1} dari ${REQUIRED_FACE_SAMPLES}…`);
        const path = samplePaths[index];
        const photo = new File([samples[index].blob], `sample-${index + 1}.webp`, { type: "image/webp" });
        const { error: uploadError } = await supabase.storage
          .from("d3-biometric-face-samples")
          .upload(path, photo, { contentType: "image/webp", cacheControl: "31536000", upsert: false });

        if (uploadError) {
          if (uploadedPaths.length > 0) {
            await supabase.storage.from("d3-biometric-face-samples").remove(uploadedPaths);
          }
          setErrorMessage(`Sampel wajah ke-${index + 1} ditolak oleh penyimpanan privat: ${uploadError.message}`);
          return;
        }
        uploadedPaths.push(path);
      }

      setSavingStage("Menyimpan template biometrik…");

      const nextTemplate: FaceTemplate = {
        descriptors: descriptors.filter((descriptor): descriptor is number[] => Boolean(descriptor)),
        createdAt: new Date().toISOString(),
        modelVersion: "human-3.3.6-insightface",
        embeddingModel: "insightface-mobilenet-swish",
        samplePaths,
      };
      const previousTemplate = templateRef.current;
      const { error } = await supabase
        .from("d3_face_biometric_templates")
        .upsert({
          employee_id: currentUser.employeeId,
          auth_user_id: currentUser.id,
          embedding_model: nextTemplate.embeddingModel,
          embedding_version: 3,
          descriptors: nextTemplate.descriptors,
          sample_paths: nextTemplate.samplePaths,
          enrollment_quality: {
            face_confidence: faceConfidence,
            liveness_score: livenessScore ?? null,
            sample_count: nextTemplate.descriptors.length,
          },
          enrolled_at: nextTemplate.createdAt,
          updated_at: nextTemplate.createdAt,
        }, { onConflict: "employee_id" });

      if (error) {
        await supabase.storage.from("d3-biometric-face-samples").remove(uploadedPaths);
        setErrorMessage(error.code === "42501"
          ? "Akun ini belum memiliki akses employee yang sesuai untuk menyimpan biometrik."
          : error.code === "23514"
            ? "Template biometrik tidak memenuhi aturan jumlah sampel. Mulai pemindaian baru lalu coba lagi."
            : "Template biometrik belum dapat disimpan. Periksa koneksi lalu coba kembali.");
        return;
      }

      templateRef.current = nextTemplate;
      setTemplate(nextTemplate);
      if (previousTemplate?.samplePaths?.length) {
        setSavingStage("Merapikan sampel registrasi sebelumnya…");
        await supabase.storage.from("d3-biometric-face-samples").remove(previousTemplate.samplePaths);
      }
      setScanState("complete");
      setActionMessage(previousTemplate
        ? "Template biometrik dan lima sampel wajah berhasil diperbarui."
        : "Template biometrik dan lima sampel wajah berhasil tersimpan.");
      stopCamera();
    } finally {
      setIsSavingTemplate(false);
      setSavingStage("");
    }
  }, [currentUser, faceConfidence, livenessScore, stopCamera]);

  useEffect(() => {
    if (!isEnrollment || !canFinalize || isSavingTemplate || scanState !== "scanning") return;
    void saveEnrollment();
  }, [canFinalize, isEnrollment, isSavingTemplate, saveEnrollment, scanState]);

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
      });

    setScanState("complete");
    setActionMessage(`${type === "CLOCK_IN" ? "Clock-in" : "Clock-out"} berhasil dicatat di Attendance History & Correction.${eventError ? " Audit biometrik belum tersimpan, tetapi data presensi sudah tercatat." : ""}`);
    stopCamera();
    window.setTimeout(() => router.push("/attendance"), 900);
  }, [currentUser, livenessScore, router, stopCamera]);

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
          .select("descriptors, enrolled_at, embedding_model, sample_paths")
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
            samplePaths: Array.isArray(storedTemplate.sample_paths) ? storedTemplate.sample_paths as string[] : [],
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

  const activePrompt = activeChallenge && scanState === "scanning" ? challengeDetails[activeChallenge] : null;
  const cameraWarning = scanState === "scanning" && !identityVerified
    ? faceCount === 0
      ? "Posisikan satu wajah ke dalam bingkai kamera."
      : faceCount > 1
        ? "Hanya satu wajah boleh terlihat di kamera."
        : faceConfidence < 60
          ? "Pencahayaan atau fokus kamera belum cukup jelas."
          : !activePrompt && !facingCenter
            ? "Kembali hadap lurus ke kamera."
            : (livenessScore ?? 0) < 0.6
              ? "Tunggu liveness membaca wajahmu dengan jelas."
              : null
    : null;
  const attendanceReady = !isEnrollment && identityVerified && allChallengesCompleted && Boolean(template) && scanState === "scanning";
  const compactCamera = attendanceReady || isAttendanceRejected;

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

      {isSavingTemplate && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0a1931]/45 p-4 backdrop-blur-sm" role="status" aria-live="polite">
          <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-[#e9f3ff] text-[#1971c2]"><LoaderCircle size={24} className="animate-spin" /></div>
            <h2 className="mt-4 text-base font-bold text-[#172033]">Menyimpan registrasi biometrik</h2>
            <p className="mt-2 text-sm leading-6 text-[#60708d]">{savingStage || "Memproses sampel wajah…"}</p>
            <p className="mt-3 text-[11px] text-[#8290a8]">Jangan menutup halaman sampai proses selesai.</p>
          </div>
        </div>
      )}

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
        {errorMessage && !isAttendanceRejected && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700"><CircleAlert size={17} className="mt-0.5 shrink-0" />{errorMessage}</div>
        )}

        <div className="mx-auto mt-5 w-full max-w-3xl">
          <section className="overflow-hidden rounded-2xl border border-[#dbe4f0] bg-white shadow-[0_4px_18px_rgba(27,53,102,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7edf5] px-5 py-4">
              <div><h3 className="text-sm font-bold text-[#172033]">Kamera verifikasi</h3><p className="mt-0.5 text-xs text-[#60708d]">Ikuti instruksi yang muncul di dalam bingkai kamera.</p></div>
              <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${scanState === "scanning" ? "bg-[#e9f3ff] text-[#1971c2]" : scanState === "error" ? "bg-red-50 text-red-600" : "bg-[#f1f5fa] text-[#60708d]"}`}>{scanState === "scanning" ? "MEMINDAI" : scanState === "loading" ? "MENYIAPKAN MODEL" : scanState === "complete" ? "SELESAI" : "SIAP"}</span>
            </div>

            <div className={`relative mx-auto aspect-square w-full transition-all duration-500 ${compactCamera ? "max-w-[300px] p-5 sm:p-6" : "max-w-[500px] p-7 sm:p-10"}`}>
              <div className={`absolute inset-3 rounded-full border shadow-[0_0_44px_rgba(27,53,102,0.18)] ${isAttendanceRejected ? "border-red-400/35" : "border-[#307ee7]/25"}`} />
              <div className={`absolute inset-7 rounded-[46%] border ${isAttendanceRejected ? "border-red-300/60" : "border-[#65b5ff]/55"}`} />
              <div className={`relative size-full overflow-hidden rounded-[46%] border-2 shadow-[0_0_0_10px_rgba(36,113,213,0.08),0_0_50px_rgba(29,115,227,0.25)] ${isAttendanceRejected ? "border-red-300/70 bg-[#260912]" : "border-[#77c0ff]/65 bg-[#071225]"}`}>
              <video ref={videoRef} muted playsInline className={`size-full origin-center scale-x-[-1] object-cover transition duration-500 ${scanState === "scanning" ? "opacity-100" : "opacity-25"}`} />
              {isAttendanceRejected ? (
                <div className="absolute inset-0 grid place-items-center p-6 text-center text-red-100"><div><div className="mx-auto grid size-14 place-items-center rounded-full border border-red-200/30 bg-red-500/20"><CircleAlert size={27} /></div><p className="mt-3 text-xs font-bold tracking-[0.08em]">WAJAH TIDAK TERVERIFIKASI</p></div></div>
              ) : scanState !== "scanning" && (
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
                {activePrompt && <div className="pointer-events-none absolute inset-x-4 top-4 rounded-xl border border-white/20 bg-[#061326]/85 p-3 text-center text-white shadow-lg"><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#9ed1ff]">Liveness {completedChallenges.length + 1}/{challengeOrder.length}</p><p className="mt-1 text-sm font-bold">{activePrompt.label}</p><p className="mt-0.5 text-[11px] text-[#dcefff]">{activePrompt.helper}</p></div>}
                {isEnrollment && allChallengesCompleted && !isSavingTemplate && <div className="pointer-events-none absolute left-1/2 top-4 max-w-[calc(100%-2rem)] -translate-x-1/2 whitespace-nowrap rounded-full border border-[#9ed1ff]/35 bg-[#061326]/85 px-3 py-1.5 text-center text-[10px] font-bold text-white shadow-lg">Mengambil sampel {faceSampleCount}/{REQUIRED_FACE_SAMPLES} · diam sebentar</div>}
                {!isEnrollment && allChallengesCompleted && !identityVerified && <div className="pointer-events-none absolute left-1/2 top-4 max-w-[calc(100%-2rem)] -translate-x-1/2 whitespace-nowrap rounded-full border border-[#9ed1ff]/35 bg-[#061326]/85 px-3 py-1.5 text-center text-[10px] font-bold text-white shadow-lg">Memverifikasi wajah…</div>}
                {cameraWarning && <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-xl border border-amber-200/35 bg-[#2a210d]/85 p-2.5 text-center text-[11px] font-semibold text-amber-100">{cameraWarning}</div>}
                {attendanceReady && <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500/90 px-3 py-1 text-[9px] font-bold tracking-[0.12em] text-white">WAJAH TERVERIFIKASI</div>}
                {!attendanceReady && !cameraWarning && !activePrompt && <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-[#061326]/75 px-3 py-1 text-[9px] font-bold tracking-[0.14em] text-[#dcefff]">FACE LOCK</div>}
              </>}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-[#e7edf5] p-5">
              {isAttendanceRejected ? (
                <button type="button" onClick={() => void startScan()} className="inline-flex items-center gap-2 rounded-lg bg-[#c4343f] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#a82431]"><Video size={16} /> Coba kembali</button>
              ) : scanState === "loading" || isResolvingSession ? (
                <button disabled className="inline-flex items-center gap-2 rounded-lg bg-[#0f2342] px-4 py-2.5 text-xs font-bold text-white opacity-75"><LoaderCircle size={16} className="animate-spin" /> Menyiapkan kamera & model…</button>
              ) : scanState === "scanning" ? (
                <button type="button" onClick={resetScan} className="inline-flex items-center gap-2 rounded-lg border border-[#d64545]/25 bg-red-50 px-4 py-2.5 text-xs font-bold text-[#b4232b] transition hover:bg-red-100"><VideoOff size={16} /> Batalkan pemindaian</button>
              ) : (
                <button type="button" onClick={() => void startScan()} className="inline-flex items-center gap-2 rounded-lg bg-[#006838] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#005b30]"><Video size={16} /> {scanState === "complete" ? "Mulai pemindaian baru" : "Mulai kamera"}</button>
              )}
              {!isEnrollment && !template && <Link href="/biometric-enrollment" className="text-xs font-semibold text-[#1971c2] underline underline-offset-4">Belum ada template untuk akun ini. Daftarkan biometrik.</Link>}
            </div>

            {attendanceReady && <div className="mx-5 mb-5 flex flex-col justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center"><div><p className="text-sm font-bold text-emerald-900">Wajah terverifikasi</p><p className="mt-1 text-xs text-emerald-800">Status identitas terkunci. Pastikan wajah masih terlihat saat mencatat kehadiran.</p></div><button type="button" onClick={() => void recordAttendance()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#006838] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#005b30]"><Clock3 size={16} /> Catat ke Attendance History</button></div>}
            {isAttendanceRejected && <div className="mx-5 mb-5 flex flex-col justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center"><div><p className="text-sm font-bold text-red-800">Wajah tidak terverifikasi</p><p className="mt-1 text-xs text-red-700">Wajah tidak cocok dengan template akun ini. Coba ulangi pemindaian dengan pemilik akun.</p></div><button type="button" onClick={() => void startScan()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#c4343f] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#a82431]"><Video size={16} /> Coba kembali</button></div>}
          </section>
        </div>

        <p className="mt-5 flex items-start gap-2 text-[11px] leading-5 text-[#4d5f81]"><Eye size={14} className="mt-0.5 shrink-0" /> Eksperimen ini bukan alat absensi produksi dan tidak menggantikan kebijakan HR. Hasil dapat dipengaruhi kualitas kamera, pencahayaan, serta kemampuan model.</p>
      </div>
    </main>
  );
}
