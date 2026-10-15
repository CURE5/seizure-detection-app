"use client";
import { cn } from "@/lib/utils";
import { SeizureEvent } from "@/types";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	Line,
	XAxis,
	YAxis,
	Tooltip,
	ResponsiveContainer,
	ReferenceLine,
	ReferenceArea,
	CartesianGrid,
	ComposedChart,
} from "recharts";

export type HRSamples = {
	t: number[];
	bpm: number[];
	rr: number[][];
	contact: (boolean | null)[];
};

type Resolution = "hour" | "day" | "week" | "month";

type HRBucket = { t: number; bpm: number | null };

type ResolutionConfig = {
	key: Resolution;
	label: string;
	bucketMs: number;
};

const RESOLUTIONS: ResolutionConfig[] = [
	{ key: "hour", label: "Hour", bucketMs: 5_000 },
	{ key: "day", label: "Day", bucketMs: 60_000 },
	{ key: "week", label: "Week", bucketMs: 10 * 60_000 },
	{ key: "month", label: "Month", bucketMs: 60 * 60_000 },
];

function rangeFor(
	resolution: Resolution,
	center: Date
): { start: Date; end: Date } {
	const c = new Date(center);
	switch (resolution) {
		case "hour": {
			const end = new Date(c);
			end.setSeconds(0, 0);
			const start = new Date(end.getTime() - 60 * 60 * 1000);
			return { start, end };
		}
		case "day": {
			const start = new Date(c);
			start.setHours(0, 0, 0, 0);
			const end = new Date(start);
			end.setDate(end.getDate() + 1);
			return { start, end };
		}
		case "week": {
			const end = new Date(c);
			end.setHours(0, 0, 0, 0);
			end.setDate(end.getDate() + 1);
			const start = new Date(end);
			start.setDate(start.getDate() - 7);
			return { start, end };
		}
		case "month": {
			const start = new Date(c.getFullYear(), c.getMonth(), 1);
			const end = new Date(c.getFullYear(), c.getMonth() + 1, 1);
			return { start, end };
		}
	}
}

function stepCenter(resolution: Resolution, center: Date, dir: 1 | -1): Date {
	const c = new Date(center);
	switch (resolution) {
		case "hour":
			c.setHours(c.getHours() + dir);
			break;
		case "day":
			c.setDate(c.getDate() + dir);
			break;
		case "week":
			c.setDate(c.getDate() + 7 * dir);
			break;
		case "month":
			c.setMonth(c.getMonth() + dir);
			break;
	}
	return c;
}

function bucketHR(
	samples: HRSamples,
	startMs: number,
	endMs: number,
	bucketMs: number
): HRBucket[] {
	const numBuckets = Math.max(0, Math.ceil((endMs - startMs) / bucketMs));
	const sums = new Float64Array(numBuckets);
	const counts = new Uint32Array(numBuckets);
	for (let i = 0; i < samples.t.length; i++) {
		// Skip samples flagged as no-contact (treat bpm as unreliable)
		if (samples.contact[i] === false) continue;
		const idx = Math.floor((samples.t[i] - startMs) / bucketMs);
		if (idx < 0 || idx >= numBuckets) continue;
		sums[idx] += samples.bpm[i];
		counts[idx] += 1;
	}
	const out: HRBucket[] = new Array(numBuckets);
	for (let i = 0; i < numBuckets; i++) {
		out[i] = {
			t: startMs + i * bucketMs + bucketMs / 2,
			bpm: counts[i] > 0 ? sums[i] / counts[i] : null,
		};
	}
	return out;
}

// Median gap between consecutive samples, in ms. Used to widen buckets when
// the source data is sparser than the configured bucket size (Garmin backfill
// at ~2 min vs. Hour view's 5 s buckets) so the line stays connected.
function medianSampleGap(t: number[]): number {
	if (t.length < 2) return 0;
	const gaps = new Array(t.length - 1);
	for (let i = 1; i < t.length; i++) gaps[i - 1] = t[i] - t[i - 1];
	gaps.sort((a, b) => a - b);
	return gaps[gaps.length >> 1];
}

function formatTick(t: number, resolution: Resolution): string {
	const d = new Date(t);
	switch (resolution) {
		case "hour":
		case "day":
			return d.toLocaleTimeString(undefined, {
				hour: "2-digit",
				minute: "2-digit",
			});
		case "week":
		case "month":
			return d.toLocaleDateString(undefined, {
				month: "short",
				day: "numeric",
			});
	}
}

function dateInputValue(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function formatRange(
	resolution: Resolution,
	start: Date,
	end: Date
): string {
	switch (resolution) {
		case "hour":
			return `${start.toLocaleString(undefined, {
				month: "short",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			})} – ${end.toLocaleTimeString(undefined, {
				hour: "2-digit",
				minute: "2-digit",
			})}`;
		case "day":
			return start.toLocaleDateString(undefined, {
				weekday: "short",
				year: "numeric",
				month: "short",
				day: "numeric",
			});
		case "week": {
			const lastDay = new Date(end.getTime() - 1);
			return `${start.toLocaleDateString(undefined, {
				month: "short",
				day: "numeric",
			})} – ${lastDay.toLocaleDateString(undefined, {
				month: "short",
				day: "numeric",
				year: "numeric",
			})}`;
		}
		case "month":
			return start.toLocaleDateString(undefined, {
				month: "long",
				year: "numeric",
			});
	}
}

export const HRGraph = ({
	className,
	width,
	height,
	loadHRData,
	loadSeizureData,
}: {
	className?: string;
	width?: string | number;
	height?: string | number;
	loadHRData: (range: {
		start: Date;
		end: Date;
	}) => Promise<HRSamples>;
	loadSeizureData: (
		range: { start: Date; end: Date } | undefined
	) => Promise<SeizureEvent[]>;
}) => {
	const [resolution, setResolution] = useState<Resolution>("hour");
	const [centerDate, setCenterDate] = useState<Date>(() => new Date());
	const [hrBuckets, setHrBuckets] = useState<HRBucket[]>([]);
	const [szInRange, setSzInRange] = useState<SeizureEvent[]>([]);
	const [loading, setLoading] = useState(false);
	const [sampleCount, setSampleCount] = useState(0);
	const [noContactCount, setNoContactCount] = useState(0);
	const [refreshTick, setRefreshTick] = useState(0);

	const gestureWrapRef = useRef<HTMLDivElement>(null);
	const rangeRef = useRef({ startMs: 0, endMs: 0 });

	const cfg = useMemo(
		() => RESOLUTIONS.find((r) => r.key === resolution)!,
		[resolution]
	);
	const range = useMemo(
		() => rangeFor(resolution, centerDate),
		[resolution, centerDate]
	);
	const startMs = range.start.getTime();
	const endMs = range.end.getTime();

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		Promise.all([
			loadHRData({ start: range.start, end: range.end }),
			loadSeizureData({ start: range.start, end: range.end }),
		])
			.then(([hr, sz]) => {
				if (cancelled) return;
				setSampleCount(hr.t.length);
				let dropped = 0;
				for (let i = 0; i < hr.contact.length; i++) {
					if (hr.contact[i] === false) dropped++;
				}
				setNoContactCount(dropped);
				// If the actual sample cadence is sparser than the resolution's
				// bucket size (e.g. Garmin backfill ~2 min in Hour/Day view),
				// widen buckets to ~2× the median sample gap so each bucket
				// captures a sample and `connectNulls={false}` doesn't blank
				// out the line. Live BLE (~1 Hz) leaves cfg.bucketMs unchanged.
				const gap = medianSampleGap(hr.t);
				const effectiveBucketMs = gap > 0
					? Math.max(cfg.bucketMs, gap * 2)
					: cfg.bucketMs;
				setHrBuckets(bucketHR(hr, startMs, endMs, effectiveBucketMs));
				setSzInRange(sz);
				setLoading(false);
			})
			.catch((err) => {
				console.error("HR fetch error", err);
				if (!cancelled) {
					setHrBuckets([]);
					setSampleCount(0);
					setNoContactCount(0);
					setLoading(false);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [startMs, endMs, cfg.bucketMs, refreshTick]);

	// Auto-refresh every minute. When the user is viewing the live tail
	// (window ends within the last minute), slide centerDate forward so the
	// window stays anchored to "now". Otherwise just refetch the same window.
	useEffect(() => {
		const id = setInterval(() => {
			const onLiveTail = Date.now() - range.end.getTime() < 60_000;
			if (onLiveTail) {
				setCenterDate(new Date());
			} else {
				setRefreshTick((n) => n + 1);
			}
		}, 60_000);
		return () => clearInterval(id);
	}, [range.end.getTime()]);

	// Keep latest range available to gesture handlers without re-attaching.
	useEffect(() => {
		rangeRef.current = { startMs, endMs };
	}, [startMs, endMs]);

	// Two-finger pan/zoom (touch) and trackpad pan/pinch (wheel).
	// Single-finger touch is left alone so recharts' tooltip keeps working.
	useEffect(() => {
		const el = gestureWrapRef.current;
		if (!el) return;

		const order: Resolution[] = ["hour", "day", "week", "month"];
		let pinch: { dist: number; cxLast: number } | null = null;
		let lastZoomAt = 0;

		const stepResolution = (dir: 1 | -1) => {
			const now = performance.now();
			if (now - lastZoomAt < 250) return; // debounce successive zoom events
			lastZoomAt = now;
			setResolution((r) => {
				const idx = order.indexOf(r);
				const next = idx + dir;
				if (next < 0 || next >= order.length) return r;
				return order[next];
			});
		};

		const panByPx = (dxPx: number) => {
			const w = el.clientWidth || 1;
			const span = rangeRef.current.endMs - rangeRef.current.startMs;
			if (span <= 0) return;
			const panMs = -(dxPx / w) * span;
			if (Math.abs(panMs) < 1) return;
			setCenterDate((d) => new Date(d.getTime() + panMs));
		};

		const onTouchStart = (e: TouchEvent) => {
			if (e.touches.length !== 2) {
				pinch = null;
				return;
			}
			const t1 = e.touches[0];
			const t2 = e.touches[1];
			pinch = {
				dist: Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY),
				cxLast: (t1.clientX + t2.clientX) / 2,
			};
		};
		const onTouchMove = (e: TouchEvent) => {
			if (e.touches.length !== 2 || !pinch) return;
			e.preventDefault();
			const t1 = e.touches[0];
			const t2 = e.touches[1];
			const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
			const cx = (t1.clientX + t2.clientX) / 2;

			panByPx(cx - pinch.cxLast);
			pinch.cxLast = cx;

			const ratio = dist / pinch.dist;
			if (ratio > 1.5) {
				stepResolution(-1);
				pinch.dist = dist;
			} else if (ratio < 1 / 1.5) {
				stepResolution(1);
				pinch.dist = dist;
			}
		};
		const onTouchEnd = (e: TouchEvent) => {
			if (e.touches.length < 2) pinch = null;
		};

		const onWheel = (e: WheelEvent) => {
			// Browsers report trackpad pinch as wheel + ctrlKey.
			if (e.ctrlKey) {
				e.preventDefault();
				if (e.deltaY < 0) stepResolution(-1);
				else if (e.deltaY > 0) stepResolution(1);
				return;
			}
			// Two-finger horizontal swipe → pan. Vertical scroll falls through to the page.
			if (Math.abs(e.deltaX) > 2 && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
				e.preventDefault();
				panByPx(-e.deltaX);
			}
		};

		el.addEventListener("touchstart", onTouchStart, { passive: true });
		el.addEventListener("touchmove", onTouchMove, { passive: false });
		el.addEventListener("touchend", onTouchEnd, { passive: true });
		el.addEventListener("touchcancel", onTouchEnd, { passive: true });
		el.addEventListener("wheel", onWheel, { passive: false });

		return () => {
			el.removeEventListener("touchstart", onTouchStart);
			el.removeEventListener("touchmove", onTouchMove);
			el.removeEventListener("touchend", onTouchEnd);
			el.removeEventListener("touchcancel", onTouchEnd);
			el.removeEventListener("wheel", onWheel);
		};
	}, []);

	const fontStyle = { fontSize: "10px" };

	return (
		<div
			className={cn(
				"bg-gray-100 dark:bg-gray-900 border border-gray-100 dark:border-none rounded-lg p-3",
				className
			)}
		>
			<div className="flex flex-wrap items-center justify-between gap-2 mb-2">
				<div className="flex items-center gap-1">
					{RESOLUTIONS.map((r) => (
						<button
							key={r.key}
							onClick={() => setResolution(r.key)}
							className={cn(
								"text-xs px-3 py-1.5 rounded",
								resolution === r.key
									? "bg-red-500 text-white"
									: "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
							)}
						>
							{r.label}
						</button>
					))}
				</div>

				<div className="flex items-center gap-1">
					<button
						onClick={() =>
							setCenterDate(stepCenter(resolution, centerDate, -1))
						}
						className="text-xs px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
					>
						‹
					</button>
					<button
						onClick={() => setCenterDate(new Date())}
						className="text-xs px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
					>
						Now
					</button>
					<button
						onClick={() =>
							setCenterDate(stepCenter(resolution, centerDate, 1))
						}
						className="text-xs px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
					>
						›
					</button>
				</div>
			</div>

			<div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex justify-between">
				<span>{formatRange(resolution, range.start, range.end)}</span>
				<span>
					{loading ? (
						"loading…"
					) : (
						<>
							{sampleCount.toLocaleString()} samples
							{noContactCount > 0 && (
								<span className="text-yellow-500">
									{" "}
									({noContactCount.toLocaleString()} no contact)
								</span>
							)}
							{" · "}
							{szInRange.length} sz
						</>
					)}
				</span>
			</div>

			{resolution === "hour" && (
				<div className="mb-2 px-1">
					<div className="flex items-center gap-2">
						<input
							type="date"
							value={dateInputValue(range.start)}
							onChange={(e) => {
								const [y, m, d] = e.target.value.split("-").map(Number);
								if (!y || !m || !d) return;
								const next = new Date(range.start);
								next.setFullYear(y, m - 1, d);
								// Keep the same hour-of-day; centerDate is end-of-window
								next.setHours(range.start.getHours() + 1, 0, 0, 0);
								setCenterDate(next);
							}}
							className="text-xs bg-gray-200 dark:bg-gray-800 dark:text-gray-200 rounded px-2 py-1.5"
						/>
						<input
							type="range"
							min={0}
							max={23}
							step={1}
							value={range.start.getHours()}
							onChange={(e) => {
								const h = parseInt(e.target.value);
								const next = new Date(range.start);
								next.setHours(h + 1, 0, 0, 0);
								setCenterDate(next);
							}}
							className="flex-1 h-2 accent-red-500 cursor-pointer touch-pan-y"
							style={{ minHeight: 32 }}
						/>
						<span className="text-xs font-mono w-20 text-right text-gray-700 dark:text-gray-300">
							{String(range.start.getHours()).padStart(2, "0")}:00–
							{String(range.end.getHours()).padStart(2, "0")}:00
						</span>
					</div>
					<div className="flex justify-between text-[10px] text-gray-500 mt-0.5 px-1">
						<span>00</span>
						<span>06</span>
						<span>12</span>
						<span>18</span>
						<span>23</span>
					</div>
				</div>
			)}

			<div
				ref={gestureWrapRef}
				style={{ touchAction: "pan-y" }}
			>
				<ResponsiveContainer width={width ?? "100%"} height={height ?? 320}>
				<ComposedChart
					data={hrBuckets}
					margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
				>
					<CartesianGrid
						strokeDasharray="3 3"
						stroke="#374151"
						strokeOpacity={0.3}
					/>
					<XAxis
						dataKey="t"
						type="number"
						domain={[startMs, endMs]}
						scale="time"
						tickFormatter={(t) => formatTick(t as number, resolution)}
						stroke="#888"
						tick={{ ...fontStyle }}
						minTickGap={30}
					/>
					<YAxis
						domain={["dataMin - 10", "dataMax + 10"]}
						stroke="#10b981"
						tick={{ ...fontStyle }}
						width={40}
						label={{
							value: "BPM",
							angle: -90,
							position: "insideLeft",
							offset: 15,
							style: { fill: "#10b981", ...fontStyle },
						}}
					/>
					<Tooltip
						contentStyle={{
							backgroundColor: "#1f2937",
							border: "1px solid #374151",
							borderRadius: "0.5rem",
							...fontStyle,
						}}
						labelStyle={{ color: "#fff", ...fontStyle }}
						itemStyle={{ ...fontStyle }}
						labelFormatter={(label) =>
							new Date(label as number).toLocaleString()
						}
						formatter={(value) =>
							typeof value === "number" ? `${Math.round(value)} bpm` : value
						}
					/>

					{szInRange.map((sz) => {
						const onset = new Date(sz.date).getTime();
						const dur = (sz.durationSeconds ?? 0) * 1000;
						// Ensure the band is visible even for very short or zero-duration sz
						const x2 = onset + Math.max(dur, cfg.bucketMs);
						return (
							<ReferenceArea
								key={`area-${sz.id ?? onset}`}
								x1={onset}
								x2={x2}
								fill="#ef4444"
								fillOpacity={0.18}
								stroke="none"
								ifOverflow="hidden"
							/>
						);
					})}
					{szInRange.map((sz) => {
						const onset = new Date(sz.date).getTime();
						return (
							<ReferenceLine
								key={`line-${sz.id ?? onset}`}
								x={onset}
								stroke="#ef4444"
								strokeWidth={1.5}
								ifOverflow="hidden"
							/>
						);
					})}

					<Line
						type="monotone"
						dataKey="bpm"
						stroke="#10b981"
						strokeWidth={1.5}
						dot={false}
						isAnimationActive={false}
						connectNulls={false}
						name="BPM"
					/>
				</ComposedChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
};
