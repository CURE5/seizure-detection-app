"use client";
import { use, useEffect, useRef, useState, memo, useMemo } from "react";
import { cn, isValidDate } from "@/lib/utils";
import { LuFullscreen } from "@/components/Icons";
import { isMobile, isIPad, timeDifference, secondsToMins } from "@/lib/utils";
import { Slider } from "@nextui-org/slider";
import { Switch } from "@nextui-org/switch";
import { NextUIProvider, Tab, Tabs } from "@nextui-org/react";

import { CircularProgress } from "@nextui-org/react";
import { PiSpeakerSimpleX, PiSpeakerSimpleHigh } from "react-icons/pi";

import React, { PureComponent } from "react";
import {
	BarChart,
	Bar,
	Cell,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ReferenceLine,
	ResponsiveContainer,
	Label,
	Customized,
} from "recharts";
import { WiDaySunnyOvercast, WiNightFog } from "react-icons/wi";
import { GiSkeletonInside } from "react-icons/gi";
import { RiFlashlightLine } from "react-icons/ri";
import { CorrelationGraph } from "@/components/CorrelationGraph";
import { SeizureLog } from "@/components/SeizureLog";
import { SeizureEvent, MedicineEvent, SleepModeType } from "@/types";
import { MedicineLog } from "@/components/MedicineLog";
import { VideoLog } from "@/components/VideoLog";
import { Diagnostics } from "@/components/Diagnostics";
import { HRGraph, HRSamples } from "@/components/HRGraph";

interface VideoFile {
	name: string;
	url: string;
	size: number;
	createdAt: string;
	formattedDate: string;
	type: string;
}

interface HRBadgeProps {
	hr: any;
}

const HRBadge: React.FC<HRBadgeProps> = ({ hr }) => {
	if (!hr || !hr.enabled) return null;

	const connected = !!hr.connected;
	const stale = !!hr.stale;
	// Strap reports no skin contact: BPM is the device's last-known value,
	// not actual heart rate. Treat like "off body" — don't show the number.
	const noContact = hr.contact === false;
	const bpm = typeof hr.bpm === "number" ? hr.bpm : null;
	const aboveAbsolute = !!hr.above_absolute;
	const aboveBaseline = !!hr.above_baseline;

	const dotColor = !connected
		? "bg-gray-400"
		: noContact || stale
		? "bg-yellow-400"
		: aboveAbsolute
		? "bg-red-500"
		: aboveBaseline
		? "bg-orange-400"
		: "bg-green-500";

	const bpmColor = aboveAbsolute
		? "text-red-400"
		: aboveBaseline
		? "text-orange-300"
		: "text-white";

	const showBpm = connected && !noContact && bpm !== null;

	return (
		<span
			className="inline-flex items-center gap-1.5"
			title={noContact ? "Strap reports no skin contact" : undefined}
		>
			<span className={cn("h-2 w-2 rounded-full", dotColor)} />
			<span className="text-[10px] text-white/70 font-semibold">HR</span>
			<span className={cn("font-mono font-bold text-sm leading-none", bpmColor)}>
				{showBpm ? bpm : "--"}
			</span>
			<span className="text-[9px] text-white/50 leading-none">
				{noContact ? "no contact" : "bpm"}
			</span>
		</span>
	);
};

const maxHistory = 50;
export default memo(function Home() {
	//when we're talking to our api to load videos we are using baseURL
	const [baseURL, setBaseURL] = useState(`${process.env.NEXT_PUBLIC_NEXT_URL}`);

	//when we are talking to the python server we are using the proxy
	const [proxyURL, setProxyURL] = useState(
		`${process.env.NEXT_PUBLIC_PROXY_URL}`
	);

	//likewise when talking to the python websocket server we are using the proxy
	const [webSocketURL, setWebSocketURL] = useState(
		`${process.env.NEXT_PUBLIC_NEXT_SOCKET_URL}`
	);

	const [videoDataReceived, setVideoDataReceived] = useState(false);

	const [videoRes, setVideoRes] = useState([640, 360]);

	const videoRef = useRef<HTMLImageElement>(null);
	const viewerRef = useRef<HTMLDivElement>(null);
	const wsRef = useRef<WebSocket>();
	const reconnectTimeout = useRef<NodeJS.Timeout>();
	const reconnectAttempts = useRef(0);
	const [isCapturing, setIsCapturing] = useState(false);
	const [isRecording, setIsRecording] = useState(false);
	const [doStartRecording, setDoStartRecording] = useState(false);

	const [fullscreen, setFullscreen] = useState(false);
	const [lensPosition, setLensPosition] = useState(0);
	const [isConnected, setIsConnected] = useState(false);
	const connectionTimeout = useRef<NodeJS.Timeout>();
	const [analyzingVideo, setAnalyzingVideo] = useState("");

	const gazeLeftHorizontal = useRef<Array<number>>([]);
	const gazeLeftVertical = useRef<Array<number>>([]);
	const gazeLeftClosed = useRef<Array<number>>([]);
	const gazeRightHorizontal = useRef<Array<number>>([]);
	const gazeRightVertical = useRef<Array<number>>([]);
	const gazeRightClosed = useRef<Array<number>>([]);

	const [nightMode, setNightMode] = useState(false);
	const [sleepMode, setSleepMode] = useState(SleepModeType.AWAKE);
	const [motionMagnitude, setMotionMgnitude] = useState(0);
	const [timeSinceLastMotion, setTimeSinceLastMotion] = useState("00:00");
	const [oldTimeSinceLastMotion, setOldTimeSinceLastMotion] = useState("00:00");
	const lastMotionTimestampRef = useRef<number>(0); // Store the base timestamp in seconds

	const [isSeizing, setIsSeizing] = useState(false);
	const seizureStartedAtRef = useRef<Date | null>();
	//const [seizureStartedAt, setSeizureStartedAt] = useState<Date | null>();
	const [seizureEndedAt, setSeizureEndedAt] = useState<Date | null>();
	const [seizureDuration, setSeizureDuration] = useState<string>("");

	const motionAlertSnd = useRef<HTMLAudioElement | null>(null);
	const szAlertSnd = useRef<HTMLAudioElement | null>(null);
	const [isAudioEnabled, setIsAudioEnabled] = useState(false);
	const [isAudioInited, setIsAudioInited] = useState(false);

	const timestampsRef = useRef<Array<number>>([]);
	const [timestamps, setTimestamps] = useState<Array<number>>([]);
	const [connectedClients, setConnectedClients] = useState(0);
	const [didRequestCameraStart, setDidRequestCameraStart] = useState(false); //if the fucker doesn't start capturing we will reboot the fucker
	const [isReadingGarmin, setIsReadingGarmin] = useState(false);
	const connectWebSocket = () => {
		try {
			const ws = (wsRef.current = new WebSocket(webSocketURL));

			ws.onmessage = (event) => {
				setIsConnected(true);
				const data = JSON.parse(event.data);
				//console.log("ws.onmessage", data);
				if (data.type === "server") {
					console.log("ws.onmessage", data);
					if (data.cmd === "recording_ended") {
						fetchVideos();
					}
					return;
				}

				if (data.type === "status") {
					setStatus(data);
					return;
				}

				if (data.video_res?.[0] > 0) {
					setVideoRes(data.video_res);
					//console.log("Video resolution:", data.video_res, videoRes);
				}

				if (!data.frame) return;
				processData(data);

				/*
			//skipping this for now
			setVideoDataReceived(true);
			// Update video frame
			const arrayBuffer = decode(data.frame);
			const blob = new Blob([arrayBuffer], { type: "image/jpeg" });
			const url = URL.createObjectURL(blob);
			if (videoRef.current) {
				// @ts-ignore
				videoRef.current.src = url;
			} else {
				console.log("Got frame but videoRef.current is null");
			}*/
				clearTimeout(connectionTimeout.current);
				connectionTimeout.current = setTimeout(() => {
					setIsConnected(false);
				}, 11 * 1000); //server sends ping every 10 seconds
			};

			ws.onopen = () => {
				console.log("WebSocket connected");
				ws.send(JSON.stringify({ type: "cmd", action: "status" }));
				setIsConnected(true);
			};

			ws.onerror = (error) => {
				console.log("WebSocket error:", error);
				ws.close();
			};
			ws.onclose = () => {
				console.log("WebSocket closed");
				scheduleReconnect();
				setIsConnected(false);
			};

			return ws;
		} catch (error) {
			console.error("Error connecting WebSocket:", error);
			return null;
		}
	};

	const reloadFrame = async () => {
		//if (!isConnected) return;
		try {
			const response = await fetch(proxyURL + "/frame");
			if (!response.ok) {
				//console.error('Failed to fetch frame:', response.statusText);
				return;
			}

			const data = await response.json();
			// Ensure the frame_base64 property exists
			processData(data);
		} catch (error) {
			console.error("Error fetching frame:", error);
		}
	};

	const getStatus = async () => {
		//if (!isConnected) return;
		try {
			const response = await fetch(proxyURL + "/status", {
				cache: "no-store",
				headers: {
					"Cache-Control": "no-cache",
				},
			});
			if (!response.ok) {
				//console.error('Failed to fetch frame:', response.statusText);
				return;
			}

			const data = await response.json();

			setStatus(data);
			setIsConnected(true);
		} catch (error) {
			console.error("Error fetching frame:", error);
		}
	};

	const waitingForSettingsToTakeEffect = useRef(false);

	const setStatus = (data: any) => {
		console.log("status", data);

		setIsCapturing(!!data.is_capturing);
		setIsRecording(!!data.is_recording);

		if (data.camera_options?.LensPosition) {
			setLensPosition(data.camera_options?.LensPosition);
		}
		setAnalyzingVideo(data.analyzing_video);
		setConnectedClients(data.connected_clients);

		setMotionMgnitude(data.motion_magnitude);
		setSleepMode(data.sleep_mode);

		if (!waitingForSettingsToTakeEffect.current) {
			setNightMode(!!data.night_mode);
		}
		setShowOverlay(!!data.show_overlay);
		setNotifyOnWakeup(!!data.notify_on_wakeup);
		setNotifyOnHrSpike(!!data.notify_on_hr_spike);
		if (data.time_since_last_motion > -1) {
			// Store the base timestamp for local interval updates
			lastMotionTimestampRef.current = data.time_since_last_motion;
		}
		if (data.diagnostics) {
			// Create a new object reference to trigger re-render
			setDiagnostics({ ...data.diagnostics });
		}
		if (data.hr !== undefined) {
			setHrData(data.hr ? { ...data.hr } : null);
		}
		setIsSeizing(!!data.is_seizing);
		if (data.seizure_started_at?.length) {
			seizureStartedAtRef.current = new Date(
				data.seizure_started_at.replace(" ", "T")
			);
			/*setSeizureStartedAt(
						new Date(data.seizure_started_at.replace(" ", "T"))
					);*/
		}
		if (data.seizure_ended_at?.length) {
			setSeizureEndedAt(new Date(data.seizure_ended_at.replace(" ", "T")));
		}
		if (data.wakeup_sleep_threshold_minutes !== undefined) {
			setWakeupSleepThresholdMinutes(data.wakeup_sleep_threshold_minutes);
		}
		if (data.wakeup_activity_threshold !== undefined) {
			setWakeupActivityThreshold(data.wakeup_activity_threshold);
		}
		if (data.last_person_detected !== undefined) {
			setLastPersonDetected(data.last_person_detected);
		}
	};

	const processData = (data: any) => {
		if (data.video_res?.[0] > 0) {
			setVideoRes(data.video_res);
		}
		if (data.frame?.length) {
			setVideoDataReceived(true);
			// Update video frame
			// const arrayBuffer = decode(data.frame);
			// const blob = new Blob([arrayBuffer], { type: "image/jpeg" });
			// const url = URL.createObjectURL(blob);
			if (videoRef.current) {
				// @ts-ignore
				//videoRef.current.src = url;
				videoRef.current.src = `data:image/jpeg;base64,${data.frame}`;
			} else {
				console.log("Got frame but videoRef.current is null");
			}
			//console.log("Got frame", data.frame.length);

			//setIsCapturing(true);
			//console.log("ws.onmessage", data.analysis);
			let analysis = data.analysis?.motion_detected;
			// Update analysis result
			gazeLeftHorizontal.current.push(
				analysis?.gaze?.left?.horizontal_position
					? analysis?.gaze?.left?.horizontal_position
					: 0
			);
			if (gazeLeftHorizontal.current?.length > maxHistory)
				gazeLeftHorizontal.current.splice(
					0,
					gazeLeftHorizontal.current.length - maxHistory
				);

			gazeLeftVertical.current.push(
				analysis?.gaze?.left?.vertical_position
					? analysis.gaze.left.vertical_position
					: 0
			);
			if (gazeLeftVertical.current?.length > maxHistory)
				gazeLeftVertical.current.splice(
					0,
					gazeLeftVertical.current.length - maxHistory
				);

			let isClosed = analysis?.gaze?.left?.is_closed;

			gazeLeftClosed.current.push(
				isClosed === true ? -1 : isClosed === false ? -2 : 0
			);
			if (gazeLeftClosed.current?.length > maxHistory)
				gazeLeftClosed.current.splice(
					0,
					gazeLeftClosed.current.length - maxHistory
				);

			gazeRightHorizontal.current.push(
				analysis?.gaze?.right?.horizontal_position
					? analysis.gaze.right.horizontal_position
					: 0
			);
			if (gazeRightHorizontal.current?.length > maxHistory)
				gazeRightHorizontal.current.splice(
					0,
					gazeRightHorizontal.current.length - maxHistory
				);

			gazeRightVertical.current.push(
				analysis?.gaze?.right?.vertical_position
					? analysis.gaze.right.vertical_position
					: 0
			);

			if (gazeRightVertical.current?.length > maxHistory)
				gazeRightVertical.current.splice(
					0,
					gazeRightVertical.current.length - maxHistory
				);

			isClosed = analysis?.gaze?.right?.is_closed;

			gazeRightClosed.current.push(
				isClosed === true ? 1 : isClosed === false ? 2 : 0
			);
			if (gazeRightClosed.current?.length > maxHistory)
				gazeRightClosed.current.splice(
					0,
					gazeRightClosed.current.length - maxHistory
				);

			timestampsRef.current.push(new Date().getTime());
			if (timestampsRef.current?.length > maxHistory)
				timestampsRef.current.splice(
					0,
					timestampsRef.current.length - maxHistory
				);

			setTimestamps([...timestampsRef.current]);
		} else {
			//console.error('No frame_base64 property in response');
		}
	};

	const scheduleReconnect = () => {
		const timeout = Math.min(
			1000 * Math.pow(2, reconnectAttempts.current),
			30000
		); // Exponential backoff
		reconnectAttempts.current += 1;

		console.log(`Reconnecting in ${timeout / 1000} seconds...`);
		reconnectTimeout.current = setTimeout(() => {
			connectWebSocket();
		}, timeout);
	};

	useEffect(() => {
		//let ws = connectWebSocket();
		getStatus();
		reloadFrame();

		let statusInt = setInterval(() => {
			getStatus();
		}, 30000);

		return () => {
			clearInterval(statusInt);
			// if (wsRef.current) {
			// 	wsRef.current.close();
			// }
			// if (reconnectTimeout.current) {
			// 	clearTimeout(reconnectTimeout.current);
			// }
		};
	}, []);

	const sendHeartbeat = () => {
		if (wsRef.current) {
			wsRef.current.send(JSON.stringify({ type: "cmd", action: "ping" }));
		}
	};

	useEffect(() => {
		let frequency = 1000 / 5; // 5 FPS
		if (
			sleepMode !== SleepModeType.AWAKE &&
			sleepMode !== SleepModeType.ANALYZING
		) {
			frequency = 1000 * 20; // 20 seconds
		}
		if (!isCapturing && analyzingVideo?.length === 0) {
			reloadFrame();
			return;
		}

		let frameInt = setInterval(reloadFrame, frequency); // 5 fps

		return () => {
			clearInterval(frameInt);
		};
	}, [sleepMode, isCapturing]);

	useEffect(() => {
		//if isSeizing create a timer that updates the seizure duration
		let seizureTimer: NodeJS.Timeout;
		if (isSeizing) {
			seizureTimer = setInterval(updateSeizureDuration, 200);
		} else {
			//@ts-ignore
			if (seizureTimer) {
				clearInterval(seizureTimer);
				//@ts-ignore
				seizureTimer = null;
			}
		}
		return () => {
			clearInterval(seizureTimer);
		};
	}, [isSeizing]);

	// Local interval to update timeSinceLastMotion display every second
	useEffect(() => {
		const updateMotionTimer = () => {
			if (lastMotionTimestampRef.current > 0) {
				const seconds = lastMotionTimestampRef.current;
				const then = new Date(seconds * 1000);
				const hh = then.getUTCHours().toString().padStart(2, "0");
				const mins = then.getUTCMinutes().toString().padStart(2, "0");
				const secs = then.getUTCSeconds().toString().padStart(2, "0");
				const newValue = `${hh}:${mins}:${secs}`;

				// Only update state if the value changed
				setTimeSinceLastMotion((prev) => {
					if (prev !== newValue) {
						setOldTimeSinceLastMotion(prev);
						return newValue;
					}
					return prev;
				});

				// Increment the timestamp for next tick
				lastMotionTimestampRef.current = seconds + 1;
			}
		};

		// Update immediately
		updateMotionTimer();

		// Then update every second
		const motionTimer = setInterval(updateMotionTimer, 1000);

		return () => {
			clearInterval(motionTimer);
		};
	}, []); // Empty deps - runs once and updates via ref

	const [videos, setVideos] = useState<VideoFile[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [selectedDate, setSelectedDate] = useState<Date | null>(null);
	const [filteredVideos, setFilteredVideos] = useState<VideoFile[]>([]);
	const [uniqueDates, setUniqueDates] = useState<string[]>([]);
	const [showOverlay, setShowOverlay] = useState(false);
	const [notifyOnWakeup, setNotifyOnWakeup] = useState(false);
	const [notifyOnHrSpike, setNotifyOnHrSpike] = useState(false);
	const [diagnostics, setDiagnostics] = useState<any>(null);
	const [hrData, setHrData] = useState<any>(null);
	const [wakeupSleepThresholdMinutes, setWakeupSleepThresholdMinutes] = useState<number>(0);
	const [wakeupActivityThreshold, setWakeupActivityThreshold] = useState<number>(0);
	const [lastPersonDetected, setLastPersonDetected] = useState<string>("");

	const [viewMode, setViewMode] = useState<"sz" | "meds" | "videos" | "hr">(
		"hr"
	);

	// Poll status every second when diagnostics overlay is enabled
	useEffect(() => {
		if (!showOverlay) return;

		const fastStatusInterval = setInterval(() => {
			getStatus();
		}, 1000);

		return () => {
			clearInterval(fastStatusInterval);
		};
	}, [showOverlay]);

	const fetchVideos = async () => {
		try {
			const response = await fetch(baseURL + "/api/videos");
			const data = await response.json();
			console.log("Fetched videos:", data);
			if (response.ok) {
				const kbPerSec = 0.0307;
				for (const video of data.videos) {
					video.url = baseURL + video.url;
					const date = new Date(video.createdAt);

					const year = date.getFullYear();
					const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are zero-based
					const day = String(date.getDate()).padStart(2, "0");

					const hours = String(date.getHours()).padStart(2, "0");
					const minutes = String(date.getMinutes()).padStart(2, "0");
					const seconds = String(date.getSeconds()).padStart(2, "0");

					video.formattedDate = `${year}-${month}-${day}  ${hours}:${minutes}:${seconds}`;
					video.type = `video/${video.url.split(".").pop()?.toLowerCase()}`;
				}
				setVideos(data.videos);
				setSelectedDate(new Date());
			} else {
				setError(data.error || "Failed to fetch videos.");
			}
		} catch (err) {
			console.error("Error fetching videos:", err);
			setError("An unexpected error occurred.");
		}
	};
	useEffect(() => {
		fetchVideos();
	}, []);

	useEffect(() => {
		// Convert createdAt to Date objects

		// Filter files for the selected date
		const _filteredVideos = videos.filter(
			(file) =>
				new Date(file.createdAt).toDateString() === selectedDate?.toDateString()
		);
		setFilteredVideos(_filteredVideos);

		// Extract unique dates with videos for marking on the calendar
		const _uniqueDates = Array.from(
			new Set(
				videos.map(
					(file) => new Date(file.createdAt).toISOString().split("T")[0]
				)
			)
		);
		setUniqueDates(_uniqueDates);
	}, [selectedDate]);

	const restartServer = async () => {
		try {
			const response = await fetch("/api/pm2/restart", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": process.env.NEXT_PUBLIC_PM2_API_KEY || "",
				},
				body: JSON.stringify({ appName: "server" }),
			});
			const data = await response.json();
			if (response.ok) {
				console.log("Server restarted:", data);
			} else {
				console.error("Failed to restart server:", data);
			}
		} catch (err) {
			console.error("Error restarting server:", err);
		}

		/*
		try {
			const response = await fetch(baseURL + "/api/pm2/restart", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": process.env.NEXT_PUBLIC_PM2_API_KEY || "",
				},
				body: JSON.stringify({ appName: "app" }),
			});
			const data = await response.json();
			if (response.ok) {
				console.log("App restarted:", data);
			} else {
				console.error("Failed to restart app:", data);
			}
		} catch (err) {
			console.error("Error restarting app:", err);
		}
		*/
		//window.location.reload();

		getStatus();
		reloadFrame();
	};

	const stopServer = async () => {
		try {
			const response = await fetch("/api/pm2/stop", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": process.env.NEXT_PUBLIC_PM2_API_KEY || "",
				},
				body: JSON.stringify({ appName: "server" }),
			});
			const data = await response.json();
			if (response.ok) {
				console.log("Server stopped:", data);
			} else {
				console.error("Failed to stop server:", data);
			}
		} catch (err) {
			console.error("Error stopping server:", err);
		}
	};

	const turnOffPi = async () => {
		try {
			console.log("Attempting to shut down Pi at:", new Date().toISOString());
			if (!confirm("Are you sure you want to turn off the Pi?")) {
				return;
			}
			console.log("Confirmed to shut down Pi at:", new Date().toISOString());
			const response = await fetch("/api/pi/shutdown", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": process.env.NEXT_PUBLIC_PM2_API_KEY || "",
				},
				body: JSON.stringify({ appName: "server" }),
			});
			const data = await response.json();
			if (response.ok) {
				console.log("Server restarted:", data);
			} else {
				console.error("Failed to restart server:", data);
			}
		} catch (err) {
			console.error("Error shutting down server:", err);
		}
	};

	const readGarmin = async () => {
		if (isReadingGarmin) return;
		setIsReadingGarmin(true);
		try {
			const response = await fetch("/api/garmin/backfill", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ days: 7 }),
			});
			const data = await response.json();
			if (response.ok) {
				console.log("Garmin backfill complete:", data);
			} else {
				console.error("Garmin backfill failed:", data);
			}
		} catch (err) {
			console.error("Error running Garmin backfill:", err);
		} finally {
			setIsReadingGarmin(false);
		}
	};

	const rebootPi = async () => {
		try {
			console.log("Attempting to reboot Pi at:", new Date().toISOString());
			if (!confirm("Are you sure you want to reboot Pi?")) {
				return;
			}
			console.log("Confirmed to reboot Pi at:", new Date().toISOString());
			const response = await fetch("/api/pi/reboot", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": process.env.NEXT_PUBLIC_PM2_API_KEY || "",
				},
				body: JSON.stringify({ appName: "server" }),
			});
			const data = await response.json();
			if (response.ok) {
				console.log("Server restarted:", data);
			} else {
				console.error("Failed to restart server:", data);
			}
		} catch (err) {
			console.error("Error reboot server:", err);
		}
	};

	useEffect(() => {
		console.log("dark mode changed:", nightMode);
		if (nightMode) {
			document.documentElement.classList.add("dark");
		} else {
			document.documentElement.classList.remove("dark");
		}
	}, [nightMode]);

	function playAndAnalyzeVideo(video: string) {
		console.log("Analyzing video:", video);
		sendCmd("analyzeVideo", video);
		// wsRef.current!.send(
		// 	JSON.stringify({ type: "cmd", action: "analyzeVideo", video: video })
		// );
	}

	function testAlert() {
		console.log("Sending test alert");
		sendCmd("testAlert");
	}
	function toggleFullscreen() {
		if (isMobile() || isIPad()) return;
		if (viewerRef.current && !document.fullscreenElement) {
			viewerRef.current.requestFullscreen().catch((err) => {
				alert(
					`Error attempting to enable fullscreen mode: ${err.message} (${err.name})`
				);
			});
		} else {
			document.exitFullscreen();
		}
	}

	function toggleNightMode() {
		waitingForSettingsToTakeEffect.current = true;
		//setTimeout(() => {
		sendCmd("night_mode", !nightMode);
		//}, 1000);

		setNightMode(!nightMode);
		setTimeout(() => {
			waitingForSettingsToTakeEffect.current = false;
		}, 6000); //wait 6 seconds before allowing changes again
	}

	async function toggleShowOverlay() {
		if (showOverlay) {
			await sendCmd("show_overlay", false);
		} else {
			await sendCmd("show_overlay", true);
		}
		setShowOverlay(!showOverlay);
	}

	async function toggleNotifyOnWakeup() {
		if (notifyOnWakeup) {
			await sendCmd("notify_on_wakeup", false);
		} else {
			await sendCmd("notify_on_wakeup", true);
		}
		setNotifyOnWakeup(!notifyOnWakeup);
	}

	async function toggleNotifyOnHrSpike() {
		await sendCmd("notify_on_hr_spike", !notifyOnHrSpike);
		setNotifyOnHrSpike(!notifyOnHrSpike);
	}

	const toggleCamera = async () => {
		if (isCapturing) {
			await sendCmd("stopCapturing");
			//setVideoDataReceived(false);
		} else {
			await restartServer();
			await sendCmd("startCapturing");
		}
		setIsCapturing(!isCapturing);
	};

	const toggleRecording = async () => {
		if (isRecording) {
			// wsRef.current!.send(
			// 	JSON.stringify({ type: "cmd", action: "stopRecording" })
			// );
			await sendCmd("stopRecording");
		} else {
			// wsRef.current!.send(
			// 	JSON.stringify({ type: "cmd", action: "startRecording" })
			// );
			await sendCmd("startRecording");
		}
		setIsRecording(!isRecording);
	};

	const toggleIsSeizing = async () => {
		if (!isSeizing) {
			// wsRef.current!.send(
			// 	JSON.stringify({
			// 		type: "cmd",
			// 		action: "seizure_started",
			// 		value: {
			// 			intensity: "3", //0 = can't tell, 1 = mild, 2 = moderate, 3 = severe
			// 			type: "Hypermotor spasm",
			// 			notes: "",
			// 		},
			// 	})
			// );
			await sendCmd("seizure_started", {
				intensity: "3", //0 = can't tell, 1 = mild, 2 = moderate, 3 = severe
				type: "Hypermotor spasm",
				notes: "",
			});
			setSeizureDuration("00:00");
		} else {
			// wsRef.current!.send(
			// 	JSON.stringify({
			// 		type: "cmd",
			// 		action: "seizure_ended",
			// 	})
			// );
			await sendCmd("seizure_ended");
			setTimeout(() => {
				loadSeizureLog().then((events) => setSeizureEvents(events));
			}, 1000);
		}

		setIsSeizing(!isSeizing);
	};

	const sendCmd = async (cmd: string, value?: any) => {
		let body = JSON.stringify({
			action: cmd,
			value: value,
		});
		console.log("Send cmd:", {
			action: cmd,
			value: value,
		});
		const response = await fetch(proxyURL + `/cmd`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: body,
		});
		console.log("Cmd response:", response);
		await getStatus();
	};

	const updateSeizureDuration = () => {
		if (seizureStartedAtRef.current) {
			let { days, hours, minutes, seconds } = timeDifference(
				seizureStartedAtRef.current.getTime(),
				Date.now()
			);
			setSeizureDuration(
				(prev) => `${hours !== "00" ? hours + ":" : ""}${minutes}:${seconds}`
			);
		} else {
			setSeizureDuration("");
		}
	};

	const createSzEvent = async (event: SeizureEvent) => {
		let postData: any = {
			...event,
			durationSeconds:
				parseInt(event.duration?.split(":")[0]) * 60 +
				parseInt(event.duration?.split(":")[1]),
			date: event.date.toISOString(),
		};
		postData.durationSeconds = `${postData.durationSeconds}`;
		let body = JSON.stringify(postData);
		console.log("Create event:", { event, postData, body });
		const response = await fetch(proxyURL + `/sz`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: body,
		});
		console.log("Create event response:", response);
		loadSeizureLog().then((events) => setSeizureEvents(events));
	};

	const editSzEvent = async (event: SeizureEvent) => {
		let postData: any = {
			...event,
			durationSeconds:
				parseInt(event.duration.split(":")[0]) * 60 +
				parseInt(event.duration.split(":")[1]),
			date: event.date.toISOString(),
		};
		postData.durationSeconds = `${postData.durationSeconds}`;
		//@ts-ignore
		delete postData.end_date;
		let body = JSON.stringify(postData);
		console.log("Editing event:", { event, postData, body });
		const response = await fetch(proxyURL + `/sz/${event.id}`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: body,
		});
		console.log("Edit event response:", response);
		loadSeizureLog().then((events) => setSeizureEvents(events));
	};

	const deleteSzEvent = async (event: SeizureEvent) => {
		if (
			!confirm(
				`Are you sure you want to delete event ${event.date.toLocaleString(
					"sv-SE"
				)}?`
			)
		) {
			return;
		}
		console.log("Delete event:", event);
		const response = await fetch(proxyURL + `/sz/${event.id}`, {
			method: "DELETE",
		});
		loadSeizureLog().then((events) => setSeizureEvents(events));
	};

	const [seizureEvents, setSeizureEvents] = useState<SeizureEvent[]>([]);
	const loadSeizureLog = async (
		range: { start: Date; end: Date } | undefined = undefined
	): Promise<SeizureEvent[]> => {
		//start 3 months ago
		if (!range) {
			start = new Date();
			start.setMonth(start.getMonth() - 3);
			end = new Date();
		} else {
			var { start, end } = range;
		}

		if (!isValidDate(start) && !isValidDate(end)) {
			throw new Error(
				"start and end must be Date objects " + start + "," + end
			);
		}

		//"2025-02-01T00:00:00";
		//const end = "2025-02-20T23:59:59";
		//start in the format "2025-01-01T00:00:00"
		const startStr = start.toISOString().split(".")[0];
		const endStr = end.toISOString().split(".")[0];
		const response = await fetch(
			proxyURL + `/sz?start=${startStr}&end=${endStr}`
		);
		const data = await response.json();
		data.events = data.events.map((event: any) => {
			event.date = new Date(event.date);
			event.duration = secondsToMins(event.durationSeconds);
			// Ensure aiDetected is always a boolean
			event.aiDetected = !!event.aiDetected;
			return event;
		});
		data.events.sort((a: any, b: any) => {
			return b.date.getTime() - a.date.getTime();
		});

		// for (const event of data.events) {
		// 	if (event.aiDetected) {
		// 		const resp = await fetch(proxyURL + `/sz/${event.id}`, {
		// 			method: "DELETE",
		// 		});
		// 		console.log("Auto-deleted aiDetected event:", event, resp);
		// 	}
		// }

		console.log({ SeizureLog: data });
		return data.events as SeizureEvent[];
	};

	useEffect(() => {
		loadSeizureLog().then((events) => setSeizureEvents(events));
	}, []);

	const [medicineEvents, setMedicineEvents] = useState<MedicineEvent[]>([]);
	const loadMedicineLog = async (
		range: { start: Date; end: Date } | undefined = undefined
	): Promise<MedicineEvent[]> => {
		//start 3 months ago
		if (!range) {
			start = new Date(2021, 7, 1);
			end = new Date();
		} else {
			var { start, end } = range;
		}

		if (!isValidDate(start) && !isValidDate(end)) {
			throw new Error(
				"start and end must be Date objects " + start + "," + end
			);
		}

		//"2025-02-01T00:00:00";
		//const end = "2025-02-20T23:59:59";
		//start in the format "2025-01-01T00:00:00"
		const startStr = start.toISOString().split(".")[0];
		const endStr = end.toISOString().split(".")[0];
		const response = await fetch(
			proxyURL + `/medicine?start=${startStr}&end=${endStr}`
		);
		const data = await response.json();
		data.events = data.events.map((event: any) => {
			event.date = new Date(event.date);
			return event;
		});
		data.events.sort((a: any, b: any) => {
			return a.date.getTime() - b.date.getTime();
		});
		console.log({ MedicineLog: data });
		return data.events as MedicineEvent[];
	};

	useEffect(() => {
		loadMedicineLog().then((events) => setMedicineEvents(events));
	}, []);

	const loadHRData = async (range: {
		start: Date;
		end: Date;
	}): Promise<HRSamples> => {
		const startStr = range.start.toISOString().split(".")[0];
		const endStr = range.end.toISOString().split(".")[0];
		try {
			const response = await fetch(
				proxyURL + `/hr?start=${startStr}&end=${endStr}`
			);
			if (!response.ok) {
				console.error("HR fetch failed", response.status);
				return { t: [], bpm: [], rr: [], contact: [] };
			}
			const data = await response.json();
			return {
				t: data.t ?? [],
				bpm: data.bpm ?? [],
				rr: data.rr ?? [],
				contact: data.contact ?? [],
			};
		} catch (err) {
			console.error("HR fetch error", err);
			return { t: [], bpm: [], rr: [], contact: [] };
		}
	};

	const createMedicineEvent = async (event: MedicineEvent) => {
		let postData: any = {
			...event,
			date: event.date.toISOString(),
		};

		let body = JSON.stringify(postData);
		console.log("Create event:", { event, postData, body });
		const response = await fetch(proxyURL + `/medicine`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: body,
		});
		console.log("Create event response:", response);
		loadMedicineLog().then((events) => setMedicineEvents(events));
	};

	const editMedicineEvent = async (event: MedicineEvent) => {
		let postData: any = {
			...event,
			date: event.date.toISOString(),
		};

		//@ts-ignore
		delete postData.end_date;
		let body = JSON.stringify(postData);
		console.log("Editing event:", { event, postData, body });
		const response = await fetch(proxyURL + `/medicine/${event.id}`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: body,
		});
		console.log("Edit event response:", response);
		loadMedicineLog().then((events) => setMedicineEvents(events));
	};

	const deleteMedicineEvent = async (event: MedicineEvent) => {
		if (
			!confirm(
				`Are you sure you want to delete event ${event.date.toLocaleString(
					"sv-SE"
				)}?`
			)
		) {
			return;
		}
		console.log("Delete event:", event);
		const response = await fetch(proxyURL + `/medicine/${event.id}`, {
			method: "DELETE",
		});
		loadMedicineLog().then((events) => setMedicineEvents(events));
	};

	const toggleSound = () => {
		setIsAudioEnabled(!isAudioEnabled);
	};

	useEffect(() => {
		if (isAudioEnabled && !isAudioInited) {
			motionAlertSnd.current = new Audio("/sounds/motion_alert.mp3");
			motionAlertSnd.current.load();
			szAlertSnd.current = new Audio("/sounds/seizure_alert.mp3");
			szAlertSnd.current.load();
			setIsAudioInited(true);
		}

		if (isAudioEnabled) {
			if (motionAlertSnd.current) {
				motionAlertSnd.current.pause();
			}
			if (szAlertSnd.current) {
				szAlertSnd.current.pause();
			}
		}
	}, [isAudioEnabled]);

	const playMotionAlert = () => {
		if (!isAudioEnabled) return;
		if (motionAlertSnd.current) {
			motionAlertSnd.current.play();
		}
	};

	useEffect(() => {
		if (
			timeSinceLastMotion.indexOf(":") > -1 &&
			oldTimeSinceLastMotion.indexOf(":") > -1
		) {
			let [hh, mins, secs] = timeSinceLastMotion.split(":");
			let timeSecs = parseInt(hh) * 3600 + parseInt(mins) * 60 + parseInt(secs);

			let [oldHh, oldMins, oldSecs] = oldTimeSinceLastMotion.split(":");
			let oldTimeSecs =
				parseInt(oldHh) * 3600 + parseInt(oldMins) * 60 + parseInt(oldSecs);

			//how long preceding inactivity needs to be to trigger a motion alert
			let ignoreDuration = 30 * 60;
			//if the subject has been asleep for more than 30 minutes,
			//and there is motion, play the alert
			if (oldTimeSecs > ignoreDuration && timeSecs < 30) {
				playMotionAlert();
			}
		}
	}, [timeSinceLastMotion, oldTimeSinceLastMotion]);
	const playSzAlert = () => {
		if (!isAudioEnabled) return;
		if (szAlertSnd.current) {
			szAlertSnd.current.play();
		}
	};

	useEffect(() => {
		if (isSeizing) {
			playSzAlert();
		}
	}, [isSeizing]);

	if (fullscreen && (isMobile() || isIPad())) {
		return (
			<NextUIProvider>
				<div>
					{isConnected ? (
						<div
							ref={viewerRef}
							key="videoViewer"
							className="bg-gray-200"
							style={{
								position: "relative",
								top: "0",
								left: "0",
								width: "100%",
								height: "100%",
								objectFit: "cover",
							}}
						>
							<img
								ref={videoRef}
								key="videoStream"
								alt="Video Stream"
								style={{
									aspectRatio: `${videoRes[0]}/${videoRes[1]}`,
									objectFit: "contain",
									width: videoDataReceived ? "100%" : "1px",
									height: videoDataReceived ? "auto" : "1px",
								}}
							/>
							{!videoDataReceived && (
								<p className="m-4">Waiting for video...</p>
							)}
						</div>
					) : (
						<div
							ref={viewerRef}
							className="bg-gray-200 p-4"
							style={{
								aspectRatio: `${videoRes[0]}/${videoRes[1]}`,
								objectFit: "contain",
								width: "100%",
								height: "auto",
							}}
						>
							<p>Not capturing video</p>
						</div>
					)}
					<div
						className="absolute top-2 right-0  cursor-pointer z-10"
						onClick={() => {
							toggleFullscreen();
							setFullscreen(false);
						}}
					>
						<LuFullscreen className="mr-2 h-4 w-4 text-white" size={18} />
					</div>
					{isConnected ? (
						<>
							<div className="absolute top-1 right-24">
								<p className="text-xs text-white">{connectedClients}</p>

								<div className="inline-flex items-center gap-3 text-xs text-white bg-black/50 px-2 py-1 rounded border border-white/10">
									<span className="h-2 w-2 rounded-full bg-green-500" />
									<span>Last motion: {timeSinceLastMotion}</span>
									{hrData?.enabled && <HRBadge hr={hrData} />}
								</div>
								<Diagnostics
									diagnostics={diagnostics}
									showOverlay={showOverlay}
									hr={hrData}
								/>
							</div>
							{!isCapturing && (
								<div className="absolute top-12 right-2">
									<p className="text-xs text-white bg-red-500/50 rounded p-1">
										Not capturing video
									</p>
								</div>
							)}
						</>
					) : (
						<div className="absolute top-2 right-20 bg-red-500" />
					)}
				</div>
			</NextUIProvider>
		);
	}

	//https://github.com/plotly/react-plotly.js#state-management
	function renderAnalysis() {
		//gaze/right/horizontal_position
		//gaze/right/vertical_position
		//gaze/right/is_closed

		//gaze/left/horizontal_position
		//...

		//pose/LEFT_EYE/x,y,z
		//pose/RIGHT_EYE/x,y,z
		//pose/LEFT_WRIST/x,y,z
		//pose/RIGHT_WRIST/x,y,z
		let fps = 5.0; //probably bit less than
		/*console.log("gazeLeftVertical", {
			gazeLeftVertical: gazeLeftVertical.current,
			gazeLeftClosed: gazeLeftClosed.current,
			timestampsRef: timestampsRef.current,
		});*/
		const data = timestampsRef.current.map((timestamp, index) => {
			return {
				timestamp: timestamp,
				//gazeLeftVertical: gazeLeftVertical.current[index],
				gazeLeftClosed: gazeLeftClosed.current[index],
				//gazeRightVertical: gazeRightVertical.current[index],
				gazeRightClosed: gazeRightClosed.current[index],
			};
		});

		return (
			<div className="h-[50vh] w-full">
				<ResponsiveContainer width="100%" height="100%">
					<BarChart
						width={500}
						height={300}
						data={data}
						margin={{
							top: 5,
							right: 30,
							left: 20,
							bottom: 5,
						}}
					>
						<CartesianGrid strokeDasharray="3 3" />
						<XAxis dataKey="name" label=""></XAxis>
						<YAxis>
							<Label
								value="Right Eye Open    "
								offset={0}
								position="insideTop"
								className="text-xs"
							></Label>
							<Label
								value="No reading    "
								offset={0}
								position="insideLeft"
								className="text-xs"
							/>
							<Label
								value="Left Eye Open    "
								offset={0}
								position="insideBottom"
								className="text-xs"
							/>
						</YAxis>
						<Tooltip />

						<ReferenceLine y={1} stroke="#000" />
						<ReferenceLine y={0} stroke="#000" />
						<ReferenceLine y={-1} stroke="#000" />
						<Bar
							dataKey="gazeLeftClosed"
							fill="#8884d8"
							isAnimationActive={false}
						/>
						<Bar
							dataKey="gazeRightClosed"
							fill="#82ca9d"
							isAnimationActive={false}
						/>
					</BarChart>
				</ResponsiveContainer>
			</div>
		);
	}

	const ViewModeSwitch = useMemo(() => {
		return (
			<div className="h-[6vh]">
				<div className="flex justify-center w-full md:mt-0 p-2">
					<Tabs
						aria-label="Tabs sizes"
						size={"sm"}
						color="success"
						onSelectionChange={(key) => {
							if (key === "Seizure") setViewMode("sz");
							else if (key === "Medication") setViewMode("meds");
							else if (key === "Video") setViewMode("videos");
							else if (key === "HR") setViewMode("hr");
						}}
					>
						<Tab key="HR" title="Heart Rate" />
						<Tab key="Seizure" title="Seizure Log" />
						<Tab key="Medication" title="Medication Log" />
						<Tab key="Video" title="Video Log" />
					</Tabs>
				</div>
			</div>
		);
	}, [viewMode]);

	const SeizureLogs = useMemo(() => {
		return (
			<div className="m-0 md:m-2 h-[40vh]">
				<div className="mb-4">
					<SeizureLog
						events={seizureEvents}
						editEvent={editSzEvent}
						deleteEvent={deleteSzEvent}
						createEvent={createSzEvent}
					/>
				</div>
			</div>
		);
	}, [seizureEvents]);

	const VideoLogs = useMemo(() => {
		return (
			<div className="m-0 md:m-2">
				{videos?.length === 0 && !error ? (
					<p>No videos found.</p>
				) : (
					<VideoLog
						setSelectedDate={setSelectedDate}
						filteredVideos={filteredVideos}
						uniqueDates={uniqueDates}
						videoRes={videoRes}
						analyzingVideo={analyzingVideo}
						playAndAnalyzeVideo={playAndAnalyzeVideo}
					/>
				)}
			</div>
		);
	}, [
		filteredVideos,
		uniqueDates,
		videoRes,
		videos,
		error,
		analyzingVideo,
		playAndAnalyzeVideo,
	]);

	const HRLogs = useMemo(() => {
		return (
			<div className="m-0 md:m-2">
				<HRGraph
					className="w-full"
					width="100%"
					height={360}
					loadHRData={loadHRData}
					loadSeizureData={loadSeizureLog}
				/>
			</div>
		);
	}, []);

	const MedicationLogs = useMemo(() => {
		return (
			<div className="m-0 md:m-2">
				<MedicineLog
					events={medicineEvents}
					editEvent={editMedicineEvent}
					deleteEvent={deleteMedicineEvent}
					createEvent={createMedicineEvent}
				/>
			</div>
		);
	}, [medicineEvents]);

	/**
	 *

	The issue was: VideoPanel was defined as a function component inside Home, 
	which meant it was recreated on every render. Even though Home is wrapped 
	in memo, any state change would cause VideoPanel to be redefined.

	The fix: Using React.useMemo() to memoize the JSX output, so it only 
	recalculates when the specified dependencies change. This prevents 
	unnecessary re-renders when unrelated state like seizureDuration, 
	motionMagnitude, or other state variables update.
	 */
	const VideoPanel = useMemo(() => {
		return (
			<div key="vv">
				<div
					ref={viewerRef}
					key="videoViewer"
					className="bg-gray-200 relative"
					style={{
						aspectRatio: `${videoRes[0]}/${videoRes[1]}`,
						objectFit: "contain",
						width: "100%",
					}}
				>
					{isConnected ? (
						<>
							<img
								key="videoStream"
								ref={videoRef}
								alt="Video Stream"
								style={{
									aspectRatio: `${videoRes[0]}/${videoRes[1]}`,
									objectFit: "contain",
									width: videoDataReceived ? "100%" : "1px",
									height: videoDataReceived ? "auto" : "1px",
								}}
							/>
							{!videoDataReceived && (
								<p className="m-4">Waiting for video...</p>
							)}

							{document.fullscreenElement ? (
								<>
									<div
										className="absolute top-2 right-0  cursor-pointer z-10"
										onClick={() => {
											toggleFullscreen();
											setFullscreen(false);
										}}
									>
										<LuFullscreen
											className="mr-4 h-4 w-4 text-white"
											size={26}
										/>
									</div>
									{isConnected ? (
										<>
											<div className="absolute top-1 left-2">
												{/*<p className="text-xs text-white">{connectedClients}</p>*/}

												<div className="inline-flex items-center gap-3 text-xs text-white bg-black/50 px-2 py-1 rounded border border-white/10">
													<span className="h-2 w-2 rounded-full bg-green-500" />
													<span>Last motion: {timeSinceLastMotion}</span>
													{hrData?.enabled && <HRBadge hr={hrData} />}
												</div>
												<Diagnostics
													diagnostics={diagnostics}
													showOverlay={showOverlay}
													hr={hrData}
												/>
											</div>
											{!isCapturing && (
												<div className="absolute top-12 right-2">
													<p className="text-xs text-white bg-red-500/50 rounded p-1">
														Not capturing video
													</p>
												</div>
											)}
										</>
									) : (
										<div className="absolute top-2 left-2 bg-red-500 rounded-lg h-2 w-2" />
									)}
								</>
							) : (
								<>
									<div
										className="absolute bottom-2 right-0  cursor-pointer z-10"
										onClick={() => {
											toggleFullscreen();
											setFullscreen(true);
										}}
									>
										<LuFullscreen
											className="mr-2 h-4 w-4 text-white"
											size={18}
										/>
									</div>
									{isConnected ? (
										<>
											<div className="absolute top-1 left-2">
												{/*<p className="text-xs text-white">{connectedClients}</p>*/}

												<div className="inline-flex items-center gap-3 text-xs text-white bg-black/50 px-2 py-1 rounded border border-white/10">
													<span className="h-2 w-2 rounded-full bg-green-500" />
													<span>Last motion: {timeSinceLastMotion}</span>
													{hrData?.enabled && <HRBadge hr={hrData} />}
												</div>
												<Diagnostics
													diagnostics={diagnostics}
													showOverlay={showOverlay}
													hr={hrData}
												/>
											</div>
											{!isCapturing && (
												<div className="absolute top-2 right-2">
													<p className="text-xs text-white bg-red-500/50 rounded p-1">
														Not capturing video
													</p>
												</div>
											)}
										</>
									) : (
										<div className="absolute top-2 left-2 bg-red-500 rounded-lg h-2 w-2" />
									)}
								</>
							)}
						</>
					) : (
						<>
							<p>Not capturing video</p>
							{isConnected ? (
								<div className="absolute top-2 right-2 bg-green-500 rounded-lg h-2 w-2" />
							) : (
								<div className="absolute top-2 right-2 bg-red-500 rounded-lg h-2 w-2" />
							)}
						</>
					)}
				</div>
			</div>
		);
	}, [
		isConnected,
		isCapturing,
		videoDataReceived,
		videoRes,
		connectedClients,
		sleepMode,
		timeSinceLastMotion,
		fullscreen,
		diagnostics,
		showOverlay,
		hrData,
	]);

	const StatusPanel = useMemo(() => {
		return (
			<div className="m-2 md:m-0 md:mt-2 dark:text-white bg-gray-100 dark:bg-gray-900 p-2 rounded-lg border border-gray-100 dark:border-none text-sm mb-4">
				<h2 className="font-bold">System Status</h2>
				<div className="grid grid-cols-2 gap-2 ">
					<div>
						<p>System Sleep Mode: {sleepMode}</p>
						<p>Motion Magnitude: {Math.round(motionMagnitude)}</p>
						<p>Time Since Last Motion: {timeSinceLastMotion}</p>
						<p>Wakeup Sleep Threshold: {wakeupSleepThresholdMinutes} min</p>
						<p>Wakeup Activity Threshold: {wakeupActivityThreshold}</p>
					</div>
					<div>
						<p>Connected Clients: {connectedClients}</p>
						<p>Last Person Detected: {lastPersonDetected || "N/A"}</p>
					</div>
				</div>

				<div className="m-2 md:m-0 grid grid-cols-2 md:grid-cols-4 gap-1">
					<button
						className="my-4 bg-gray-500 hover:bg-gray-700 text-xs text-white py-1 px-2 rounded"
						onClick={() => {
							restartServer();
						}}
					>
						{"Restart Server"}
					</button>
					<button
						className="my-4 bg-gray-500 hover:bg-gray-700 text-xs text-white py-1 px-2 rounded"
						onClick={() => {
							testAlert();
						}}
					>
						{"Test alerts"}
					</button>

					<button
						className="my-4 bg-gray-500 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs text-white py-1 px-2 rounded"
						disabled={isReadingGarmin}
						onClick={() => {
							readGarmin();
						}}
					>
						{isReadingGarmin ? "Reading Garmin…" : "Read Garmin"}
					</button>

					<button
						className="my-4 bg-gray-500 hover:bg-gray-700 text-xs text-white py-1 px-2 rounded"
						onClick={() => {
							rebootPi();
						}}
					>
						{"Reboot Pi"}
					</button>

					<button
						className={cn(
							"my-4 hover:bg-gray-700 text-xs text-white py-1 px-2 rounded",
							showOverlay ? "bg-green-600" : "bg-gray-500"
						)}
						onClick={() => {
							toggleShowOverlay();
						}}
					>
						{"Show Overlay: " + (showOverlay ? "On" : "Off")}
					</button>
					<button
						className={cn(
							"my-4 hover:bg-gray-700 text-xs text-white py-1 px-2 rounded",
							notifyOnWakeup ? "bg-green-600" : "bg-gray-500"
						)}
						onClick={() => {
							toggleNotifyOnWakeup();
						}}
					>
						{"Notify on Wakeup: " + (notifyOnWakeup ? "On" : "Off")}
					</button>
					<button
						className={cn(
							"my-4 hover:bg-gray-700 text-xs text-white py-1 px-2 rounded",
							notifyOnHrSpike ? "bg-green-600" : "bg-gray-500"
						)}
						onClick={() => {
							toggleNotifyOnHrSpike();
						}}
					>
						{"Notify on HR Spike: " + (notifyOnHrSpike ? "On" : "Off")}
					</button>
				</div>
			</div>
		);
	}, [
		showOverlay,
		notifyOnWakeup,
		notifyOnHrSpike,
		sleepMode,
		motionMagnitude,
		timeSinceLastMotion,
		connectedClients,
		wakeupSleepThresholdMinutes,
		wakeupActivityThreshold,
		isReadingGarmin,
		lastPersonDetected,
	]);

	const VideoControlPanel = useMemo(() => {
		if (isConnected) {
			return (
				<div className="bg-gray-100 dark:bg-gray-900 px-4 rounded-lg mt-2 min-h-[56vh] relative flex flex-col">
					<div className="m-2 md:m-0 grid grid-cols-2 gap-1 ">
						<button
							disabled={!isConnected}
							className="my-4 bg-blue-500 hover:bg-blue-700 text-sm text-white font-bold py-1 px-2 rounded"
							onClick={() => {
								toggleRecording();
							}}
						>
							{isRecording ? "Stop Recording" : "Start Recording"}
						</button>
						<button
							disabled={!isConnected}
							className="my-4 bg-blue-500 hover:bg-blue-700 text-sm text-white font-bold py-1 px-2 rounded"
							onClick={() => {
								toggleCamera();
							}}
						>
							{isCapturing ? "Stop Camera" : "Start Camera"}
						</button>
					</div>

					<div className="m-2 md:m-0 flex justify-center items-center flex-1">
						<button
							className={`m-8 w-52 h-52 text-white font-bold rounded-full flex items-center justify-center  ${
								isSeizing
									? "hover:bg-red-600 bg-red-500"
									: "hover:bg-blue-600 bg-blue-500"
							}`}
							onClick={toggleIsSeizing}
						>
							{isSeizing ? (
								<div className="whitespace-break-spaces">
									<p className="text-5xl mb-0 mt-4">{seizureDuration}</p>

									<p className="text-lg mt-2">SZ</p>
									<div className="w-full flex items-center justify-center">
										<RiFlashlightLine size={18} />
									</div>
								</div>
							) : (
								<div className="whitespace-break-spaces">
									{seizureDuration !== "00:00" && (
										<p className="text-3xl mb-0 mt-4">{seizureDuration}</p>
									)}

									<p className="text-5xl">SZ</p>
									<div className="w-full flex items-center justify-center">
										<RiFlashlightLine size={14} />
									</div>
								</div>
							)}
						</button>
					</div>
					<div className="flex justify-end items-end pb-3 pr-0">
						{/* <Switch
								disabled={!isConnected}
								isSelected={isAudioEnabled}
								onChange={() => {
									toggleSound();
								}}
								classNames={{
									wrapper: [
										"bg-gray-900",
										"group-data-[selected=true]:bg-blue-500",
										"mr-2",
									],
									thumb: isAudioEnabled ? "bg-white" : "bg-gray-300",
									endContent: "text-gray-50",
									startContent: "text-gray-100",
								}}
								size="md"
								startContent={<PiSpeakerSimpleHigh size={14} className="" />}
								endContent={<PiSpeakerSimpleX size={14} className=" " />}
							/> */}
						<Switch
							disabled={!isConnected}
							defaultSelected={!nightMode}
							//isSelected={!nightMode}
							onChange={toggleNightMode}
							classNames={{
								wrapper: [
									"bg-gray-900",
									"group-data-[selected=true]:bg-blue-400",
								],
								thumb: nightMode ? "bg-red-400" : "bg-yellow-300",
								endContent: "text-amber-50",
								startContent: "text-yellow-100",
							}}
							size="md"
							startContent={<WiDaySunnyOvercast size={18} className="" />}
							endContent={<WiNightFog size={18} className=" " />}
						/>
					</div>
				</div>
			);
		} else {
			return (
				<div className="m-2 md:m-0 flex justify-center min-h-screen">
					<div className="mt-20 ">
						<CircularProgress
							isIndeterminate={true}
							size="lg"
							label="Connecting..."
						/>
					</div>
				</div>
			);
		}
	}, [
		isConnected,
		isRecording,
		isCapturing,
		isAudioEnabled,
		nightMode,
		isSeizing,
		seizureDuration,
	]);

	const CombinedGraph = useMemo(() => {
		return (
			<CorrelationGraph
				className={"w-full "}
				aspectRatio={`${videoRes[0]}/${videoRes[1]}`}
				width="100%"
				height="100%"
				loadSeizureData={loadSeizureLog}
				loadMedicineData={loadMedicineLog}
				//startDate={new Date(2021, 7, 1)}
				//endDate={new Date()}
			/>
		);
	}, []);

	return (
		<NextUIProvider>
			<div className="p-0 md:p-2 ">
				{error && <p style={{ color: "red" }}>{error}</p>}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
					<div>
						{VideoPanel}

						{VideoControlPanel}
					</div>

					<div className="m-2 md:m-0">
						{CombinedGraph}
						<div className="border border-gray-100 dark:bg-gray-900 dark:border-none rounded-lg mt-2">
							{ViewModeSwitch}

							<div className="overflow-y-auto min-h-[50vh]">
								{viewMode === "sz"
									? SeizureLogs
									: viewMode === "meds"
									? MedicationLogs
									: viewMode === "videos"
									? VideoLogs
									: viewMode === "hr"
									? HRLogs
									: null}
							</div>
						</div>
					</div>
				</div>
				{StatusPanel}
			</div>
		</NextUIProvider>
	);
});
