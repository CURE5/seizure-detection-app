//w h was 24
export const LuFullscreen = (props: {
	className?: string;
	onClick?: () => void;
	size: number;
}) => {
	const { className, onClick, size } = props;
	return (
		<div className={className} onClick={onClick}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width={size}
				height={size}
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="lucide lucide-fullscreen"
			>
				<path d="M3 7V5a2 2 0 0 1 2-2h2" />
				<path d="M17 3h2a2 2 0 0 1 2 2v2" />
				<path d="M21 17v2a2 2 0 0 1-2 2h-2" />
				<path d="M7 21H5a2 2 0 0 1-2-2v-2" />
				<rect width="10" height="8" x="7" y="8" rx="1" fill="currentColor" />
			</svg>
		</div>
	);
};
