export const LuZoomOut = (props: {
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
			>
				<circle cx="11" cy="11" r="8" />
				<line x1="21" x2="16.65" y1="21" y2="16.65" />
				<line x1="8" x2="14" y1="11" y2="11" />
			</svg>
		</div>
	);
};
