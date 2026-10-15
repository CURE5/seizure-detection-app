import { Calendar } from "@nextui-org/react";

export const VideoLog = ({
	setSelectedDate,
	filteredVideos,
	uniqueDates,
	videoRes,
	analyzingVideo,
	playAndAnalyzeVideo,
}: {
	setSelectedDate: (date: Date) => void;
	filteredVideos: {
		name: string;
		url: string;
		type: string;
		formattedDate: string;
	}[];
	uniqueDates: string[];
	videoRes: number[];
	analyzingVideo: string | null;
	playAndAnalyzeVideo: (videoName: string) => void;
}) => {
	return (
		<div className="py-2">
			<div className="flex justify-center w-full mb-4 md:mt-0 mt-4">
				<Calendar
					onChange={(date) => {
						const { year, month, day } = date;
						setSelectedDate(new Date(year, month - 1, day));
					}}
					// Highlight days with entries
					isDateUnavailable={(date) =>
						!uniqueDates.includes(date.toString().split("T")[0])
					}
				/>
			</div>

			<ul style={{ listStyle: "none", padding: 0 }}>
				{filteredVideos.map((video) => (
					<li key={video.name}>
						<video
							//playsInline={true}
							style={{
								aspectRatio: `${videoRes[0]}/${videoRes[1]}`,
								objectFit: "contain",
								width: "100%",
							}}
							controls
						>
							<source src={video.url} type={video.type} />
							Your browser does not support the video tag.
						</video>
						<div className="flex justify-between">
							<a
								className={`cursor-pointer text-xs font-bold mb-2 ${
									analyzingVideo === video.name
										? "text-green-500"
										: "text-gray-500"
								}`}
								onClick={() => playAndAnalyzeVideo(video.name)}
							>
								{analyzingVideo === video.name ? "Analyzing..." : "Analyze"}
							</a>
							<p className="text-xs font-bold mb-2">{video.formattedDate} </p>
						</div>
					</li>
				))}
			</ul>
		</div>
	);
};
