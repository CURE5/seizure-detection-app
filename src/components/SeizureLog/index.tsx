/*make a component showing seizure durations and times over a selected time period, (default to 3 months).
the list should expand vertically, and on the horizontal axis, show the time of day.
each entry should support the option to edit the seizure duration, time, severity and add a notes
each entry should have a delete button
*/

"use client";
import { SeizureEvent } from "@/types";
import { use, useEffect, useRef, useState, Fragment } from "react";
import { LuTrash2, LuPlus, LuNotepadText } from "react-icons/lu";
import { GiChiliPepper } from "react-icons/gi";
import { secondsToMins } from "@/lib/utils";

import {
	Modal,
	ModalContent,
	ModalHeader,
	ModalBody,
	ModalFooter,
	Button,
	useDisclosure,
	Input,
	Select,
	SelectItem,
	Textarea,
} from "@nextui-org/react";
/*
I need to be able to select time range, 
*/

export const szTypes = [
	{ key: "Hypermotor spasm", label: "Hypermotor spasm" },
	{ key: "Note", label: "Note" },
	{ key: "Unknown", label: "Unknown" },
	{ key: "Epileptic spasm", label: "Epileptic spasm" },
	{ key: "Tonic clonic", label: "Tonic clonic" },
	{ key: "Drop seizure", label: "Drop seizure" },
	{ key: "Myoclonic", label: "Myoclonic" },
	{ key: "Tonic spasms", label: "Tonic spasms" },
];

export const intensity = [
	{ key: "0", label: "Can't say" },
	{ key: "1", label: "Mild" },
	{ key: "2", label: "Medium" },
	{ key: "3", label: "Severe" },
];
export const SeizureLog = ({
	events,
	createEvent,
	editEvent,
	deleteEvent,
}: {
	events: SeizureEvent[];
	createEvent: (event: SeizureEvent) => void;
	editEvent: (event: SeizureEvent) => void;
	deleteEvent: (event: SeizureEvent) => void;
}) => {
	const { isOpen, onOpen, onOpenChange } = useDisclosure();

	const dayInSecs = 86400; //seizure.durationSeconds/dayInSecs
	const hours = [];
	for (let i = 0; i < 24; i++) {
		hours.push(String(i).padStart(2, "0"));
	}

	/*
    Get avg duration and count for 
    last 7 days
    then rolling avg per 30 days for the last 3 months

    */
	const [avgDuration7days, setAvgDuration7days] = useState(0);
	const [avgDuration30days1, setAvgDuration30days1] = useState(0);
	const [avgDuration30days2, setAvgDuration30days2] = useState(0);
	const [avgDuration30days3, setAvgDuration30days3] = useState(0);
	const [count7days, setCount7days] = useState(0);
	const [count30days1, setCount30days1] = useState(0);
	const [count30days2, setCount30days2] = useState(0);
	const [count30days3, setCount30days3] = useState(0);

	useEffect(() => {
		const now = new Date().getTime();
		const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
		const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
		const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;
		const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

		// Ensure `event.date` is correctly parsed as a Date object
		const getEventTime = (event: SeizureEvent) =>
			new Date(event.date).getTime();

		const knownSz = events.filter(
			(event) => event.type !== "Note" && event.type !== "Unknown"
		);

		// Filter events for each time window
		const sevenDaysEvents = knownSz.filter(
			(event) => getEventTime(event) > sevenDaysAgo
		);
		const last30DaysEvents = knownSz.filter(
			(event) => getEventTime(event) > thirtyDaysAgo
		);
		const last30to60DaysEvents = knownSz.filter(
			(event) =>
				getEventTime(event) > sixtyDaysAgo &&
				getEventTime(event) <= thirtyDaysAgo
		);
		const last60to90DaysEvents = knownSz.filter(
			(event) =>
				getEventTime(event) > ninetyDaysAgo &&
				getEventTime(event) <= sixtyDaysAgo
		);

		// Compute average durations (avoid division by zero)
		const computeAvg = (eventList: SeizureEvent[]) => {
			if (!eventList.length) return 0;

			let sum = 0;
			eventList
				.map((event) => parseInt(`${event.durationSeconds}`))
				.forEach((duration) =>
					event?.type !== szTypes[0].key ? (sum += duration) : null
				);

			return sum / eventList.length;
		};

		// Set averages
		setAvgDuration7days(computeAvg(sevenDaysEvents));
		setAvgDuration30days1(computeAvg(last30DaysEvents));
		setAvgDuration30days2(computeAvg(last30to60DaysEvents));
		setAvgDuration30days3(computeAvg(last60to90DaysEvents));

		// Set counts
		setCount7days(sevenDaysEvents.length);
		setCount30days1(last30DaysEvents.length);
		setCount30days2(last30to60DaysEvents.length);
		setCount30days3(last60to90DaysEvents.length);
	}, [events]);

	const [selectedEvent, setSelectedEvent] = useState<SeizureEvent | null>(null);
	const [editObj, setEditObj] = useState<any | null>(null);

	return (
		<div className="py-2">
			{/* add circle plus icon to top right to add new seizure */}

			<LuPlus
				className="cursor-pointer float-right m-2 bg-blue-500"
				onClick={() => {
					setEditObj({
						duration: "00:00",
						type: "Hypermotor spasm",
						intensity: "0",
						date: new Date(),
						notes: "",
					});
					setSelectedEvent(null);
					onOpen();
				}}
			>
				Open Modal
			</LuPlus>
			<div className="border dark:border-gray-800 w-full grid grid-cols-7 text-xs p-2 text-nowrap text-center justify-center items-center dark:text-white">
				<div className="text-gray-400">Date</div>
				<div className="text-gray-400">Duration</div>
				<div className="text-gray-400 col-span-2">Type</div>
				<div className="text-gray-400">Intensity</div>
				<div className="text-gray-400">Notes</div>
				<div className="text-gray-400">AI</div>

				<div className="col-span-7 flex justify-between text-gray-300">
					{hours.map((hour) => {
						return <div key={hour}>{hour}</div>;
					})}
				</div>

				{events.map((seizure: any, i) => {
					return (
						<div
							key={seizure.id}
							onClick={() => {
								setEditObj(null);
								setSelectedEvent(seizure);
								onOpen();
							}}
							className="cursor-pointer w-full col-span-7 grid grid-cols-7 text-xs text-nowrap text-center justify-center items-center dark:text-white hover:bg-gray-200"
						>
							<p className="relative z-10">{`${seizure.date
								.toLocaleString("sv-SE")
								.substring(0, 10)}`}</p>
							<p className="relative z-10">{seizure.duration}</p>
							<p className="relative z-10 col-span-2">{seizure.type}</p>
							<span className="flex justify-center relative z-10">
								{seizure.intensity === "1" && (
									<GiChiliPepper className="text-yellow-500" />
								)}
								{seizure.intensity === "2" && (
									<>
										<GiChiliPepper className="text-orange-500" />
										<GiChiliPepper className="text-orange-500" />
									</>
								)}
								{seizure.intensity === "3" && (
									<>
										<GiChiliPepper className="text-red-500" />
										<GiChiliPepper className="text-red-500" />
										<GiChiliPepper className="text-red-500" />
									</>
								)}
							</span>
							<span className="flex justify-center">
								{seizure.notes ? (
									<LuNotepadText className="cursor-pointer" />
								) : (
									<span className="text-gray-300"></span>
								)}
							</span>
							<span className="flex justify-center relative z-10">
								{seizure.aiDetected ? (
									<span className="text-green-500 font-bold">✓</span>
								) : (
									<span className="text-gray-300">—</span>
								)}
							</span>
							<div className="col-span-7 bg-gray-300 relative h-[1px]  z-0">
								<div
									className={`absolute top-[-1px] h-[3px] bg-red-500`}
									style={{
										width: `${
											Math.max(0.01, seizure.durationSeconds / dayInSecs) * 100
										}%`,
										left: `${
											((seizure.date.getHours() * 60 +
												seizure.date.getMinutes()) /
												1440) *
											100
										}%`,
									}}
								></div>
							</div>
						</div>
					);
				})}
			</div>

			<div className="my-4  border dark:border-gray-700 bg-gray-100 dark:bg-gray-800 rounded-lg dark:mx-2 p-2 dark:text-white ">
				<h2>Seizure Stats</h2>
				<div className="grid grid-cols-3 text-xs">
					<p>Last 7 days</p>
					<p>Avg duration: {secondsToMins(avgDuration7days)}</p>
					<p>Count: {count7days}</p>

					<p>Last 30 days</p>
					<p>Avg duration: {secondsToMins(avgDuration30days1)}</p>
					<p>Count: {count30days1}</p>

					<p>Previous 30 days</p>
					<p>Avg duration: {secondsToMins(avgDuration30days2)}</p>
					<p>Count: {count30days2}</p>

					<p>Previous 30 days</p>
					<p>Avg duration: {secondsToMins(avgDuration30days3)}</p>
					<p>Count: {count30days3}</p>
				</div>
			</div>

			<Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="center">
				<ModalContent style={{ maxHeight: "60vh", overflowY: "auto" }}>
					{(onClose) => (
						<>
							<ModalHeader className="flex flex-col gap-1 dark:text-white">
								{selectedEvent?.id ? "Edit" : "Create"} Seizure Event
							</ModalHeader>
							<ModalBody>
								<Input
									label="Date"
									type="datetime-local"
									value={
										editObj?.date
											? editObj.date.toLocaleString("sv-SE")
											: selectedEvent?.date
											? selectedEvent.date.toLocaleString("sv-SE")
											: null
									}
									onChange={(e) => {
										//console.log(e.target.value);
										let prevObj = editObj;
										if (!editObj) {
											prevObj = {};
										}

										setEditObj({
											...prevObj,
											date: new Date(e.target.value),
										});
									}}
								/>
								<Input
									label="Duration"
									pattern="(^$|[0-9]{2}:[0-5][0-9])"
									placeholder="00:00"
									type="string"
									value={
										editObj?.duration || editObj?.duration === ""
											? editObj.duration
											: selectedEvent?.duration
											? selectedEvent.duration
											: "00:00"
									}
									onChange={(e) => {
										let prevObj = editObj;
										if (!editObj) {
											prevObj = {};
										}

										setEditObj({
											...prevObj,
											duration: e.target.value,
										});
									}}
									onFocus={(e) => {
										setTimeout(() => {
											e.target.scrollIntoView({
												behavior: "smooth",
												block: "center",
											});
										}, 300); // Delay allows keyboard to open before adjusting
									}}
								/>
								<Select
									className="max-w-xs"
									label="Seizure type"
									defaultSelectedKeys={[
										editObj?.type
											? editObj.type
											: selectedEvent?.type
											? selectedEvent.type
											: szTypes[1].key,
									]}
									value={
										editObj?.type
											? editObj.type
											: selectedEvent?.type
											? selectedEvent.type
											: szTypes[1].key
									}
									onChange={(e) => {
										let prevObj = editObj;
										if (!editObj) {
											prevObj = {};
										}
										setEditObj({
											...prevObj,
											type: e.target.value,
										});
									}}
								>
									{szTypes.map((szT) => (
										<SelectItem className="dark:bg-gray-400" key={szT.key}>
											{szT.label}
										</SelectItem>
									))}
								</Select>
								<Select
									className="max-w-xs"
									label="Intensity"
									defaultSelectedKeys={[
										editObj?.intensity
											? editObj.intensity
											: selectedEvent?.intensity
											? selectedEvent.intensity
											: intensity[0].key,
									]}
									value={
										editObj?.intensity
											? editObj.intensity
											: selectedEvent?.intensity
											? selectedEvent.intensity
											: intensity[2].key
									}
									onChange={(e) => {
										let prevObj = editObj;
										if (!editObj) {
											prevObj = {};
										}
										setEditObj({
											...prevObj,
											intensity: e.target.value,
										});
									}}
									onFocus={(e) => {
										setTimeout(() => {
											e.target.scrollIntoView({
												behavior: "smooth",
												block: "center",
											});
										}, 300); // Delay allows keyboard to open before adjusting
									}}
								>
									{intensity.map((szT) => (
										<SelectItem className="dark:bg-gray-400" key={szT.key}>
											{szT.label}
										</SelectItem>
									))}
								</Select>
								<Textarea
									label="Notes"
									placeholder=""
									type="string"
									value={
										editObj?.notes || editObj?.notes === ""
											? editObj.notes
											: selectedEvent?.notes
											? selectedEvent.notes
											: ""
									}
									onChange={(e) => {
										let prevObj = editObj;
										if (!editObj) {
											prevObj = {};
										}

										setEditObj({
											...prevObj,
											notes: e.target.value,
										});
									}}
									onFocus={(e) => {
										setTimeout(() => {
											e.target.scrollIntoView({
												behavior: "smooth",
												block: "center",
											});
										}, 300); // Delay allows keyboard to open before adjusting
									}}
								/>
							</ModalBody>
							<ModalFooter
								className={`flex align-center ${
									selectedEvent?.id ? "justify-between" : "justify-end"
								} `}
							>
								{selectedEvent?.id && (
									<Button
										className=""
										color="danger"
										variant="light"
										onPress={() => {
											deleteEvent(selectedEvent);
											onClose();
										}}
									>
										Delete
									</Button>
								)}

								<Button
									color="primary"
									disabled={editObj === null}
									onPress={async () => {
										if (editObj) {
											if (selectedEvent?.id) {
												await editEvent({
													...selectedEvent,
													...editObj,
												});
											} else {
												await createEvent(editObj);
											}
											setEditObj(null);
											setSelectedEvent(null);
											onClose();
										}
									}}
									className={
										editObj === null ? "cursor-not-allowed bg-gray-300" : ""
									}
								>
									Save
								</Button>
							</ModalFooter>
						</>
					)}
				</ModalContent>
			</Modal>
		</div>
	);
};
