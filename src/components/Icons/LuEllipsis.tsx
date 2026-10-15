export const LuEllipsis = (props: {
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
				className="lucide lucide-ellipsis"
			>
				<circle cx="12" cy="12" r="1" />
				<circle cx="19" cy="12" r="1" />
				<circle cx="5" cy="12" r="1" />
			</svg>
		</div>
	);
};
