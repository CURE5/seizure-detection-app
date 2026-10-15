/*make a component showing medicine durations and times over a selected time period, (default to 3 months).
the list should expand vertically, and on the horizontal axis, show the time of day.
each entry should support the option to edit the medicine duration, time, severity and add a notes
each entry should have a delete button
*/

"use client";
import { MedicineEvent, MedicineEventType } from "@/types";
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

export const MedicineLog = ({
	events,
	createEvent,
	editEvent,
	deleteEvent,
}: {
	events: MedicineEvent[];
	createEvent: (event: MedicineEvent) => void;
	editEvent: (event: MedicineEvent) => void;
	deleteEvent: (event: MedicineEvent) => void;
}) => {
	const { isOpen, onOpen, onOpenChange } = useDisclosure();

	const [selectedEvent, setSelectedEvent] = useState<MedicineEvent | null>(
		null
	);
	const [editObj, setEditObj] = useState<any | null>(null);

	const [didSuggestDrug, setDidSuggestDrug] = useState<boolean>(false);

	const knownDrugs = Array.from(
		new Set(events.map((event) => event.name))
	).sort();

	const reverseSortedEvents = [...events].sort(
		(a, b) => b.date.getTime() - a.date.getTime()
	);

	return (
		<div>
			{/* add circle plus icon to top right to add new medicine */}

			<LuPlus
				className="cursor-pointer float-right m-2 bg-blue-500"
				onClick={() => {
					setEditObj({
						name: "",
						type: MedicineEventType.STARTED,
						dosage: "0",
						date: new Date(),
						notes: "",
					});
					setSelectedEvent(null);
					onOpen();
				}}
			>
				Open Modal
			</LuPlus>
			<div className=" border dark:border-gray-800 w-full grid grid-cols-5 text-xs p-2 text-nowrap text-center justify-center items-center dark:text-white">
				<div className="text-gray-400">Date</div>
				<div className="text-gray-400">Name</div>
				<div className="text-gray-400">Dosage</div>
				<div className="text-gray-400">Type</div>
				<div className="text-gray-400">Notes</div>

				{reverseSortedEvents.map((medicine: any, i) => {
					return (
						<div
							key={medicine.id}
							onClick={() => {
								setEditObj(null);
								setSelectedEvent(medicine);
								setDidSuggestDrug(false);
								onOpen();
							}}
							className="cursor-pointer w-full col-span-5 grid grid-cols-5 text-xs text-nowrap text-center justify-center items-center dark:text-white hover:bg-gray-200"
						>
							<p className="relative z-10">{`${medicine.date
								.toLocaleString("sv-SE")
								.substring(0, 10)}`}</p>
							<p className="relative z-10">{medicine.name}</p>
							<p className="relative z-10">{medicine.dosage}</p>
							<p className="relative z-10">{medicine.type}</p>

							<span className="flex justify-center">
								{medicine.notes ? (
									<LuNotepadText className="cursor-pointer" />
								) : (
									<span className="text-gray-300"></span>
								)}
							</span>
						</div>
					);
				})}
			</div>

			<Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="center">
				<ModalContent style={{ maxHeight: "60vh", overflowY: "auto" }}>
					{(onClose) => (
						<>
							<ModalHeader className="flex flex-col gap-1 dark:text-white">
								{selectedEvent?.id ? "Edit" : "Create"} Medicine Event
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
									label="Name"
									placeholder="Medicine Name"
									type="string"
									value={
										editObj?.name || editObj?.name === ""
											? editObj.name
											: selectedEvent?.name
											? selectedEvent.name
											: ""
									}
									onChange={(e) => {
										let prevObj = editObj;
										if (!editObj) {
											prevObj = {};
										}

										//if the first 3 letters match a known drug, autofill
										const matchedDrug = knownDrugs.find((drug) =>
											drug
												.toLowerCase()
												.startsWith(
													e.target.value.toLowerCase().substring(0, 3)
												)
										);
										if (
											matchedDrug &&
											e.target.value.length > 2 &&
											!didSuggestDrug
										) {
											// autofill logic here
											setDidSuggestDrug(true);
											setEditObj({
												...prevObj,
												name: matchedDrug,
											});
										} else {
											setEditObj({
												...prevObj,
												name: e.target.value,
											});
										}
									}}
									onFocus={(e) => {
										setDidSuggestDrug(false);
										setTimeout(() => {
											e.target.scrollIntoView({
												behavior: "smooth",
												block: "center",
											});
										}, 300); // Delay allows keyboard to open before adjusting
									}}
									onBlur={(e) => {
										setDidSuggestDrug(false);
									}}
								/>
								<Input
									label="Dosage (no unit, eg. 100)"
									placeholder="0"
									type="string"
									value={
										editObj?.dosage || editObj?.dosage === ""
											? editObj.dosage
											: selectedEvent?.dosage
											? selectedEvent.dosage
											: "0"
									}
									onChange={(e) => {
										let prevObj = editObj;
										if (!editObj) {
											prevObj = {};
										}

										setEditObj({
											...prevObj,
											dosage: e.target.value,
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
									label="Event"
									defaultSelectedKeys={[
										editObj?.type
											? editObj.type
											: selectedEvent?.type
											? selectedEvent.type
											: MedicineEventType.STARTED,
									]}
									value={
										editObj?.type
											? editObj.type
											: selectedEvent?.type
											? selectedEvent.type
											: MedicineEventType.STARTED
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
									{Object.values(MedicineEventType).map((t) => (
										<SelectItem className="dark:bg-gray-400" key={t}>
											{t}
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
											setDidSuggestDrug(false);
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
											setDidSuggestDrug(false);
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
