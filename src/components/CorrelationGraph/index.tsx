"use client";
import { cn, isValidDate } from "@/lib/utils";
import { MedicineEvent, MedicineEventType, SeizureEvent } from "@/types";
import { Fragment, useEffect, useState } from "react";
import {
	LineChart,
	Line,
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
	ComposedChart,
} from "recharts";

// Sample combined data - replace with your actual data
// Combine all metrics into one dataset for overlay
const dummyData = [
	{
		month: "Jan",
		seizureDuration: 45,
		seizureCount: 3,
		medicine1: 50,
		medicine2: 100,
		medicine3: 25,
	},
	{
		month: "Feb",
		seizureDuration: 32,
		seizureCount: 2,
		medicine1: 50,
		medicine2: 100,
		medicine3: 25,
	},
	{
		month: "Mar",
		seizureDuration: 58,
		seizureCount: 3,
		medicine1: 60,
		medicine2: 120,
		medicine3: 30,
	},
	{
		month: "Apr",
		seizureDuration: 41,
		seizureCount: 3,
		medicine1: 60,
		medicine2: 120,
		medicine3: 30,
	},
	{
		month: "May",
		seizureDuration: 35,
		seizureCount: 3,
		medicine1: 55,
		medicine2: 110,
		medicine3: 28,
	},
	{
		month: "Jun",
		seizureDuration: 29,
		seizureCount: 3,
		medicine1: 55,
		medicine2: 110,
		medicine3: 28,
	},
];

export type CorrelationGraphData = {
	month: string;
	year?: number;
	seizureDuration: number; //secs
	seizureCount: number;
	[key: string]: any;
};
export const CorrelationGraph = ({
	className,
	aspectRatio,
	width,
	height,
	startDate,
	endDate,
	loadSeizureData,
	loadMedicineData,
}: {
	className?: string;
	aspectRatio?: string;
	width?: string | number;
	height?: string | number;
	startDate?: Date;
	endDate?: Date;
	loadSeizureData: (
		range: { start: Date; end: Date } | undefined
	) => Promise<SeizureEvent[]>;
	loadMedicineData: (
		range: { start: Date; end: Date } | undefined
	) => Promise<any[]>;
}) => {
	//convert seizureEvents to combinedData format here
	//calculating monthly totals for seizure duration and count

	const monthNames = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	];

	const [combinedData, setCombinedData] = useState<CorrelationGraphData[]>([]);

	const [selectedYears, setSelectedYears] = useState<number[]>([]);
	const [rangeStartDate, setRangeStartDate] = useState<Date | undefined>(
		startDate
	);
	const [rangeEndDate, setRangeEndDate] = useState<Date | undefined>(endDate);

	const [allMedicineEvents, setAllMedicineEvents] = useState<MedicineEvent[]>(
		[]
	);

	const [loadedMedicineEvents, setLoadedMedicineEvents] =
		useState<boolean>(false);

	const [allUsedMedicines, setAllUsedMedicines] = useState<Set<string>>(
		new Set()
	);
	useEffect(() => {
		//select all years from 2021
		const yearsSet = new Set<number>();
		const currentYear = new Date().getFullYear();
		yearsSet.add(2021);
		yearsSet.add(currentYear);

		setSelectedYears(Array.from(yearsSet));
	}, []);

	const getNameDoseKey = (med: MedicineEvent) => {
		return med.name + " (" + med.dosage + ")";
	};
	useEffect(() => {
		if (startDate && endDate) return;
		setRangeStartDate(new Date(selectedYears[0], 0, 1));
		setRangeEndDate(new Date(selectedYears[selectedYears.length - 1], 11, 31));
	}, [selectedYears]);

	const isDateInRange = (date: Date) => {
		if (rangeStartDate && date < rangeStartDate) return false;
		if (rangeEndDate && date > rangeEndDate) return false;
		return true;
	};

	const didTakeMedicineThisMonth = (
		startDate: Date,
		endDate?: Date,
		monthDate?: Date
	) => {
		if (!isValidDate(endDate)) {
			return startDate <= monthDate!;
		} else {
			return startDate <= monthDate! && endDate! >= monthDate!;
		}
	};

	const fetchData = async () => {
		const data: CorrelationGraphData[] = [];
		const szEvents = await loadSeizureData(
			rangeStartDate && rangeEndDate
				? { start: rangeStartDate, end: rangeEndDate }
				: undefined
		);

		szEvents.forEach((event) => {
			if (!(event.durationSeconds > 0)) {
				return;
			}
			const date = new Date(event.date);

			const month = monthNames[date.getMonth()];
			const year = date.getFullYear();

			let monthData = data.find(
				(data) => data.month === month && data.year === year
			);
			if (!monthData) {
				monthData = {
					month: month,
					year,
					seizureDuration: 0,
					seizureCount: 0,
				};
				data.push(monthData);
			}

			//@ts-ignore
			monthData.seizureDuration += parseInt(event.durationSeconds);
			monthData.seizureCount += 1;
		});

		let medicineEvents = allMedicineEvents;
		if (!loadedMedicineEvents) {
			//laod all meds...filter later
			medicineEvents = await loadMedicineData({
				start: new Date(2021, 0, 1),
				end: new Date(),
			});
			setAllMedicineEvents(medicineEvents);
			setLoadedMedicineEvents(true);
		}

		//unless there's a stopped event, every started event is active
		//add them to each month until a stopped event is found
		const medHistory: {
			[key: string]: {
				startDate?: Date;
				endDate?: Date;
				name: string;
				dosage: string;
			};
		} = {};
		//note, when two meds have the same dosage the lines will overlap and interfere in graph
		medicineEvents.forEach((med) => {
			const date = new Date(med.date);
			let nameDoseKey = getNameDoseKey(med);
			//console.log("Processing med event", { med, date, nameDoseKey });
			//if (isDateInRange(date)) {
			if (!medHistory[nameDoseKey]) {
				medHistory[nameDoseKey] = {
					name: med.name,
					dosage: med.dosage,
				};
			}

			if (med.type === MedicineEventType.STARTED) {
				//since events are ordered, this will actually work correctly for
				//when we have several start events for the same drug at different dosages
				medHistory[nameDoseKey].startDate = date;
			} else if (med.type === MedicineEventType.STOPPED) {
				medHistory[nameDoseKey].endDate = date;
			}

			//}
		});
		//medHistory now have start and end dates for each med+dosage, unless not stopped
		//but if med was started before rangeStartDate, we should still only add
		//from rangeStartDate, not from startDate of medHistory
		setAllUsedMedicines(new Set());
		for (const nameDoseKey in medHistory) {
			if (!medHistory[nameDoseKey].startDate) {
				console.error("No start date for ", nameDoseKey);
				continue;
			}
			// Loop through each month between birthDate and rangeEndDate
			//this is needed to capture meds started before rangeStartDate
			//but ensure we only add meds used in the selected date range
			let currentDate = new Date(rangeStartDate!);
			while (currentDate <= rangeEndDate!) {
				if (
					didTakeMedicineThisMonth(
						medHistory[nameDoseKey].startDate,
						medHistory[nameDoseKey].endDate,
						currentDate
					)
				) {
					const month = monthNames[currentDate.getMonth()];
					const year = currentDate.getFullYear();
					//find existing monthData from graph data
					let graphMonthData = data.find(
						(data) => data.month === month && data.year === year
					);
					if (!graphMonthData) {
						graphMonthData = {
							month,
							year,
							seizureDuration: 0,
							seizureCount: 0,
						};
						graphMonthData[medHistory[nameDoseKey].name] = parseInt(
							medHistory[nameDoseKey].dosage
						);
						data.push(graphMonthData);
					} else {
						graphMonthData[medHistory[nameDoseKey].name] = parseInt(
							medHistory[nameDoseKey].dosage
						);
					}
					//this med is used in the selected date range
					setAllUsedMedicines((prev) =>
						new Set(prev).add(medHistory[nameDoseKey].name)
					);
				}

				// Move to the next month
				currentDate.setMonth(currentDate.getMonth() + 1);
			}
		}

		// Calculate average duration per seizure for each month
		data.forEach((monthData) => {
			if (monthData.seizureCount > 0) {
				monthData.seizureDuration =
					Math.round(monthData.seizureDuration / monthData.seizureCount) / 60;
				monthData.seizureDuration =
					Math.round(monthData.seizureDuration * 100) / 100;
			}
		});

		// Sort by year and month in chronological order
		data.sort((a, b) => {
			if (a.year !== b.year) {
				return a.year! - b.year!;
			}

			return monthNames.indexOf(a.month) - monthNames.indexOf(b.month);
		});

		console.log("Combined Data:", {
			combinedData: data,
			seizureEvents: szEvents,
			medicineEvents: medicineEvents,
			medHistory,
			allUsedMedicines,
		});
		setCombinedData(data);
	};
	useEffect(() => {
		//check if set and valid dates
		if (isValidDate(rangeStartDate) && isValidDate(rangeEndDate)) {
			fetchData();
		}
	}, [rangeEndDate]);

	{
		/* Combined Chart with Multiple Y-Axes */
	}
	const fonstStyle = { fontSize: "10px" };

	// Generate deterministic color from string seed
	const stringToColor = (seed: string) => {
		let hash = 0;
		for (let i = 0; i < seed.length; i++) {
			hash = seed.charCodeAt(i) + ((hash << 5) - hash);
		}

		// Use different bits of hash for better color distribution
		const hue = Math.abs((hash * 137) % 360); // Golden angle for better distribution
		const saturation = 60 + (Math.abs(hash >> 10) % 30); // 60-90%
		const lightness = 45 + (Math.abs(hash >> 20) % 20); // 45-65%

		return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
	};

	function yearSelector() {
		const arr = [];
		for (let year = 2021; year <= new Date().getFullYear(); year++) {
			const isSelected =
				year >= selectedYears[0] &&
				year <= selectedYears[selectedYears.length - 1];
			arr.push(
				<p
					key={year}
					onClick={(e) => {
						if (!isSelected) {
							// set start and end date based on selected years
							// if before current end year, start year here
							if (year < selectedYears[selectedYears.length - 1]) {
								const yearsSet = new Set<number>();
								yearsSet.add(year);
								yearsSet.add(selectedYears[selectedYears.length - 1]);
								setSelectedYears(Array.from(yearsSet));
							} else {
								const yearsSet = new Set<number>();
								yearsSet.add(selectedYears[0]);
								yearsSet.add(year);
								setSelectedYears(Array.from(yearsSet));
							}
						} else if (selectedYears.length > 1) {
							// Remove year
							if (year < selectedYears[selectedYears.length - 1]) {
								const yearsSet = new Set<number>();
								yearsSet.add(year + 1);
								yearsSet.add(selectedYears[selectedYears.length - 1]);
								setSelectedYears(Array.from(yearsSet));
							} else {
								const yearsSet = new Set<number>();
								yearsSet.add(selectedYears[0]);
								yearsSet.add(year - 1);

								setSelectedYears(Array.from(yearsSet));
							}
						}
					}}
					className={cn(
						"inline-flex items-center mr-2 text-xs ",
						"ml-1 cursor-pointer",
						isSelected
							? "text-red-500  dark:text-red-500"
							: "text-gray-700 dark:text-gray-600"
					)}
				>
					{year}
				</p>
			);
		}
		return (
			<div className="absolute index-2 md:w-1/2 left-[45%] flex justify-center -mt-[14px]">
				<div className="flex flex-wrap justify-center gap-1">{arr}</div>
			</div>
		);
	}
	return (
		<div
			className={cn(
				"bg-gray-100 dark:bg-gray-900 border border-gray-100 dark:border-none rounded-lg  pt-4",
				className
			)}
			style={{
				aspectRatio: aspectRatio,
			}}
		>
			{/*
			Make a small selected year range selector above the graph
			*/}

			{yearSelector()}

			{/*<h2 className="text-lg font-semibold dark:text-white mb-4">
				Seizure Activity & Medicine Correlation
			</h2>*/}
			<ResponsiveContainer width={width} height={height}>
				<ComposedChart
					data={combinedData}
					margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
				>
					{/*<CartesianGrid strokeDasharray="3 3" />*/}
					<XAxis dataKey="month" stroke="#888" tick={{ ...fonstStyle }} />
					{/* Left Y-axis for seizure duration (minutes) */}
					<YAxis
						yAxisId="duration"
						stroke="#ef4444"
						tick={{ ...fonstStyle }}
						width={55}
						label={{
							value: "Duration (min)",
							angle: -90,
							position: "insideLeft",
							offset: 30,
							style: { fill: "#ef4444", ...fonstStyle },
						}}
					/>
					{/* Right Y-axis for seizure count */}
					<YAxis
						yAxisId="count"
						orientation="right"
						stroke="#8b5cf6"
						tick={{ ...fonstStyle }}
						width={55}
						label={{
							value: "Count",
							angle: 90,
							position: "insideRight",
							offset: 30,
							style: { fill: "#8b5cf6", ...fonstStyle },
						}}
					/>
					{/* Far right Y-axis for medicine doses */}
					<YAxis
						yAxisId="medicine"
						orientation="right"
						stroke="#10b981"
						tick={{ ...fonstStyle }}
						width={50}
						label={{
							value: "Dose (mg)",
							angle: 90,
							position: "insideRight",
							offset: 25,
							style: { fill: "#10b981", ...fonstStyle },
						}}
					/>{" "}
					<Tooltip
						contentStyle={{
							backgroundColor: "#1f2937",
							border: "1px solid #374151",
							borderRadius: "0.5rem",
							...fonstStyle,
						}}
						labelStyle={{ color: "#fff", ...fonstStyle }}
						itemStyle={{ ...fonstStyle }}
						labelFormatter={(value, payload) => {
							if (payload && payload[0]) {
								const data = payload[0].payload as CorrelationGraphData;
								return `${data.month} ${String(data.year).slice(-2)}`;
							}
							return value;
						}}
					/>
					<Legend
						wrapperStyle={{ paddingTop: "20px", ...fonstStyle }}
						iconType="line"
					/>
					{/* Seizure Duration - Bar */}
					<Bar
						yAxisId="duration"
						dataKey="seizureDuration"
						fill="#ef4444"
						fillOpacity={0.6}
						name="Seizure Duration (min)"
					/>
					{/* Seizure Count - Bar */}
					<Bar
						yAxisId="count"
						dataKey="seizureCount"
						fill="#8b5cf6"
						fillOpacity={0.6}
						name="Seizure Count"
					/>
					{/* Medicine Lines */}
					{Array.from(allUsedMedicines).map((name, index) => (
						<Line
							key={name + "__" + index}
							yAxisId="medicine"
							type="monotone"
							dataKey={name}
							stroke={stringToColor(name)}
							strokeWidth={3}
							name={`${name}`}
							activeDot={{ r: 6 }}
							dot={(props: any) => {
								const { cx, cy, index, payload } = props;
								/*
								// Only show dot if value changed from previous point
								if (index === 0) return <></>; // No dot on first point
								const prevValue = combinedData[index - 1]?.[name];
								const currentValue = payload[name];
								if (prevValue === currentValue) return <></>;
								return (
									<circle
										cx={cx}
										cy={cy}
										r={4}
										fill={stringToColor(name)}
										stroke="white"
										strokeWidth={1}
									/>
								);*/
								return <Fragment key={index}></Fragment>;
							}}
						/>
					))}
				</ComposedChart>
			</ResponsiveContainer>
		</div>
	);
};
