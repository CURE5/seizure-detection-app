import React from "react";
import { cn } from "@/lib/utils";

interface DiagnosticsData {
	gates?: {
		motion?: {
			threshold: number;
			current_value: number;
			enabled: boolean;
			description: string;
		};
		activity?: {
			threshold: number;
			current_value: number;
			enabled: boolean;
			description: string;
		};
	};
	models?: {
		motion_lstm?: {
			enabled: boolean;
			confidence_threshold: number;
			description: string;
		};
		pose_onnx?: {
			enabled: boolean;
			confidence_threshold: number;
			description: string;
		};
	};
	persistence_filters?: {
		pose_persistence?: {
			window_seconds: number;
			confidence_threshold: number;
			persistence_threshold: number;
			min_duration_seconds: number;
			current_predictions: number;
			current_persistence_score: number;
			current_duration: number;
			seizure_detected: boolean;
			description: string;
		};
		motion_persistence?: {
			window_seconds: number;
			confidence_threshold: number;
			persistence_threshold: number;
			min_duration_seconds: number;
			current_predictions: number;
			current_persistence_score: number;
			current_duration: number;
			seizure_detected: boolean;
			description: string;
		};
	};
	seizure_state?: {
		onset_threshold_seconds: number;
		offset_threshold_seconds: number;
		in_seizure: boolean;
		current_duration: number | null;
		description: string;
	};
}

interface HRData {
	enabled?: boolean;
	connected?: boolean;
	bpm?: number | null;
	stale?: boolean;
	baseline_bpm?: number | null;
	above_baseline?: boolean;
	above_absolute?: boolean;
	sustained_sec?: number;
	last_alert_at?: string | null;
}

interface DiagnosticsProps {
	diagnostics: DiagnosticsData | null;
	showOverlay: boolean;
	hr?: HRData | null;
}

export const Diagnostics: React.FC<DiagnosticsProps> = ({
	diagnostics,
	showOverlay,
	hr,
}) => {
	if (!showOverlay || !diagnostics) return null;

	//console.log("Diagnostics component received:", diagnostics);

	const formatValue = (val: number, decimals = 3) => {
		if (val === null || val === undefined) return "N/A";
		return val.toFixed(decimals);
	};

	// Format small decimal values (e.g., 0.0023 -> "2.3")
	const formatScaledValue = (val: number) => {
		if (val === null || val === undefined) return "N/A";
		// Scale by 1000 to convert 0.001 range to 1.0 range
		return (val * 1000).toFixed(1);
	};

	const formatDuration = (seconds: number | null) => {
		if (seconds === null || seconds === undefined) return "N/A";
		return `${seconds.toFixed(1)}s`;
	};

	const formatPercent = (val: number) => {
		if (val === null || val === undefined) return "N/A";
		return `${(val * 100).toFixed(1)}%`;
	};

	return (
		<div className="relative z-10 text-xs text-white/90 space-y-2 mt-2 max-w-md">
			{/* Gates */}
			{diagnostics.gates && (
				<div className="bg-black/40 p-2 rounded border border-white/10">
					<div className="font-semibold mb-1 text-white">Detection Gates</div>
					{diagnostics.gates.motion && (
						<div className="ml-2">
							<div className="flex justify-between items-center">
								<span className="text-white/70">Motion Gate:</span>
								<div className="text-right">
									<span className="text-white font-mono text-sm font-semibold">
										{formatScaledValue(diagnostics.gates.motion.current_value)}
									</span>
									<span className="text-white/50 text-[10px] ml-1">
										(threshold:{" "}
										{formatScaledValue(diagnostics.gates.motion.threshold)})
									</span>
								</div>
							</div>
						</div>
					)}
					{diagnostics.gates.activity && diagnostics.gates.activity.enabled && (
						<div className="ml-2">
							<div className="flex justify-between items-center">
								<span className="text-white/70">Activity Gate:</span>
								<div className="text-right">
									<span className="text-white font-mono text-sm font-semibold">
										{formatScaledValue(
											diagnostics.gates.activity.current_value
										)}
									</span>
									<span className="text-white/50 text-[10px] ml-1">
										(threshold:{" "}
										{formatScaledValue(diagnostics.gates.activity.threshold)})
									</span>
								</div>
							</div>
						</div>
					)}
				</div>
			)}

			{/* Heart Rate */}
			{hr && hr.enabled && (
				<div className="bg-black/40 p-2 rounded border border-white/10">
					<div className="font-semibold mb-1 text-white">Heart Rate</div>
					<div className="ml-2 space-y-0.5">
						<div className="flex justify-between items-center">
							<span className="text-white/70">BPM:</span>
							<div className="text-right">
								<span
									className={cn(
										"font-mono font-semibold text-sm",
										!hr.connected
											? "text-gray-400"
											: hr.above_absolute
											? "text-red-400"
											: hr.above_baseline
											? "text-orange-300"
											: "text-white"
									)}
								>
									{hr.connected && typeof hr.bpm === "number" ? hr.bpm : "--"}
								</span>
								{hr.baseline_bpm != null && (
									<span className="text-white/50 text-[10px] ml-1">
										(baseline: {hr.baseline_bpm})
									</span>
								)}
							</div>
						</div>
						<div className="flex justify-between items-center">
							<span className="text-white/70">Status:</span>
							<span
								className={cn(
									"text-[11px] font-semibold",
									!hr.connected
										? "text-gray-400"
										: hr.stale
										? "text-yellow-300"
										: "text-green-400"
								)}
							>
								{!hr.connected
									? "Disconnected"
									: hr.stale
									? "Stale"
									: "Live"}
							</span>
						</div>
						{hr.connected && (hr.above_baseline || hr.above_absolute) && (
							<div className="flex justify-between items-center">
								<span className="text-white/70">Elevated:</span>
								<span className="text-orange-300 font-semibold text-[11px]">
									{hr.above_absolute
										? "Above absolute"
										: "Above baseline"}
									{typeof hr.sustained_sec === "number" &&
										hr.sustained_sec > 0 &&
										` · ${hr.sustained_sec.toFixed(1)}s`}
								</span>
							</div>
						)}
					</div>
				</div>
			)}

			{/* Models */}
			{diagnostics.models && (
				<div className="bg-black/30 p-2 rounded">
					<div className="font-semibold mb-1">AI Models</div>
					{diagnostics.models.motion_lstm && (
						<div className="ml-2">
							<div className="flex justify-between">
								<span className="text-white/70">Motion LSTM:</span>
								<span
									className={
										diagnostics.models.motion_lstm.enabled
											? "text-green-400"
											: "text-gray-400"
									}
								>
									{diagnostics.models.motion_lstm.enabled
										? "Enabled"
										: "Disabled"}
								</span>
							</div>
						</div>
					)}
					{diagnostics.models.pose_onnx && (
						<div className="ml-2">
							<div className="flex justify-between">
								<span className="text-white/70">Pose ONNX:</span>
								<span
									className={
										diagnostics.models.pose_onnx.enabled
											? "text-green-400"
											: "text-gray-400"
									}
								>
									{diagnostics.models.pose_onnx.enabled
										? "Enabled"
										: "Disabled"}
								</span>
							</div>
						</div>
					)}
				</div>
			)}

			{/* Persistence Filters */}
			{diagnostics.persistence_filters && (
				<div className="bg-black/40 p-2 rounded border border-white/10">
					<div className="font-semibold mb-1 text-white">
						Persistence Filters
					</div>
					{diagnostics.persistence_filters.motion_persistence && (
						<div className="ml-2 mb-2 bg-black/20 p-1.5 rounded">
							<div className="text-white font-semibold mb-1 text-[11px]">
								Motion LSTM:
							</div>
							<div className="ml-2 space-y-1">
								<div className="flex justify-between items-center">
									<span className="text-white/60 text-[10px]">
										Predictions (
										{
											diagnostics.persistence_filters.motion_persistence
												.window_seconds
										}
										s window):
									</span>
									<span className="text-white font-mono font-semibold">
										{
											diagnostics.persistence_filters.motion_persistence
												.current_predictions
										}
									</span>
								</div>
								<div className="flex justify-between items-center">
									<span className="text-white/60 text-[10px]">
										Persistence Score:
									</span>
									<div className="text-right">
										<span
											className={cn(
												"font-mono font-semibold text-sm",
												diagnostics.persistence_filters.motion_persistence
													.current_persistence_score >=
													diagnostics.persistence_filters.motion_persistence
														.persistence_threshold
													? "text-green-400"
													: "text-yellow-300"
											)}
										>
											{formatPercent(
												diagnostics.persistence_filters.motion_persistence
													.current_persistence_score
											)}
										</span>
										<span className="text-white/50 text-[10px] ml-1">
											(need ≥
											{formatPercent(
												diagnostics.persistence_filters.motion_persistence
													.persistence_threshold
											)}
											)
										</span>
									</div>
								</div>
								<div className="flex justify-between items-center">
									<span className="text-white/60 text-[10px]">Duration:</span>
									<div className="text-right">
										<span
											className={cn(
												"font-mono font-semibold text-sm",
												diagnostics.persistence_filters.motion_persistence
													.current_duration >=
													diagnostics.persistence_filters.motion_persistence
														.min_duration_seconds
													? "text-green-400"
													: "text-yellow-300"
											)}
										>
											{formatDuration(
												diagnostics.persistence_filters.motion_persistence
													.current_duration
											)}
										</span>
										<span className="text-white/50 text-[10px] ml-1">
											(need ≥
											{
												diagnostics.persistence_filters.motion_persistence
													.min_duration_seconds
											}
											s)
										</span>
									</div>
								</div>
								<div className="flex justify-between items-center pt-0.5 border-t border-white/10">
									<span className="text-white/70 font-semibold text-[10px]">
										SEIZURE DETECTED:
									</span>
									<span
										className={
											diagnostics.persistence_filters.motion_persistence
												.seizure_detected
												? "text-red-400 font-bold text-sm"
												: "text-gray-500 text-sm"
										}
									>
										{diagnostics.persistence_filters.motion_persistence
											.seizure_detected
											? "YES"
											: "No"}
									</span>
								</div>
							</div>
						</div>
					)}
					{diagnostics.persistence_filters.pose_persistence && (
						<div className="ml-2 bg-black/20 p-1.5 rounded">
							<div className="text-white font-semibold mb-1 text-[11px]">
								Pose ONNX:
							</div>
							<div className="ml-2 space-y-1">
								<div className="flex justify-between items-center">
									<span className="text-white/60 text-[10px]">
										Predictions (
										{
											diagnostics.persistence_filters.pose_persistence
												.window_seconds
										}
										s window):
									</span>
									<span className="text-white font-mono font-semibold">
										{
											diagnostics.persistence_filters.pose_persistence
												.current_predictions
										}
									</span>
								</div>
								<div className="flex justify-between items-center">
									<span className="text-white/60 text-[10px]">
										Persistence Score:
									</span>
									<div className="text-right">
										<span
											className={cn(
												"font-mono font-semibold text-sm",
												diagnostics.persistence_filters.pose_persistence
													.current_persistence_score >=
													diagnostics.persistence_filters.pose_persistence
														.persistence_threshold
													? "text-green-400"
													: "text-yellow-300"
											)}
										>
											{formatPercent(
												diagnostics.persistence_filters.pose_persistence
													.current_persistence_score
											)}
										</span>
										<span className="text-white/50 text-[10px] ml-1">
											(need ≥
											{formatPercent(
												diagnostics.persistence_filters.pose_persistence
													.persistence_threshold
											)}
											)
										</span>
									</div>
								</div>
								<div className="flex justify-between items-center">
									<span className="text-white/60 text-[10px]">Duration:</span>
									<div className="text-right">
										<span
											className={cn(
												"font-mono font-semibold text-sm",
												diagnostics.persistence_filters.pose_persistence
													.current_duration >=
													diagnostics.persistence_filters.pose_persistence
														.min_duration_seconds
													? "text-green-400"
													: "text-yellow-300"
											)}
										>
											{formatDuration(
												diagnostics.persistence_filters.pose_persistence
													.current_duration
											)}
										</span>
										<span className="text-white/50 text-[10px] ml-1">
											(need ≥
											{
												diagnostics.persistence_filters.pose_persistence
													.min_duration_seconds
											}
											s)
										</span>
									</div>
								</div>
								<div className="flex justify-between items-center pt-0.5 border-t border-white/10">
									<span className="text-white/70 font-semibold text-[10px]">
										SEIZURE DETECTED:
									</span>
									<span
										className={
											diagnostics.persistence_filters.pose_persistence
												.seizure_detected
												? "text-red-400 font-bold text-sm"
												: "text-gray-500 text-sm"
										}
									>
										{diagnostics.persistence_filters.pose_persistence
											.seizure_detected
											? "YES"
											: "No"}
									</span>
								</div>
							</div>
						</div>
					)}
				</div>
			)}

			{/* Seizure State */}
			{diagnostics.seizure_state && (
				<div className="bg-black/30 p-2 rounded">
					<div className="font-semibold mb-1">Seizure State</div>
					<div className="ml-2 space-y-0.5">
						<div className="flex justify-between">
							<span className="text-white/70">In Seizure:</span>
							<span
								className={
									diagnostics.seizure_state.in_seizure
										? "text-red-400 font-semibold"
										: "text-green-400"
								}
							>
								{diagnostics.seizure_state.in_seizure ? "YES" : "No"}
							</span>
						</div>
						{diagnostics.seizure_state.current_duration !== null && (
							<div className="flex justify-between">
								<span className="text-white/70">Duration:</span>
								<span className="text-white">
									{formatDuration(diagnostics.seizure_state.current_duration)}
								</span>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
};
