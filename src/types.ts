export type SeizureEvent = {
  id?: string;
  date: Date;
  duration: string;
  durationSeconds: number;
  type: string;
  intensity: string;
  video?: string;
  notes?: string;
  aiDetected?: boolean;
};

export enum MedicineEventType {
  STARTED = "started",
  STOPPED = "stopped",
  MISSED = "missed",
}
export type MedicineEvent = {
  id?: string;
  date: Date;
  type: MedicineEventType;
  name: string;
  dosage: string;
  notes?: string;
};

export enum SleepModeType {
  AWAKE = "AWAKE",
  ANALYZING = "ANALYZING",
  TRANSITIONING = "TRANSITIONING",
  LIGHT_SLEEP = "LIGHT_SLEEP",
  DEEP_SLEEP = "DEEP_SLEEP",
}
