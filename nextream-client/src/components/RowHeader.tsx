'use client';

import Link from 'next/link';

interface RowHeaderProps {
	title: string;
	subtitle?: string;
	exploreHref?: string;
}

export default function RowHeader({ title, subtitle, exploreHref }: RowHeaderProps) {
	return (
		<div className="flex items-end justify-between px-4 mb-2 sm:mb-4">
			<div>
				<h2 className="text-white text-base sm:text-lg md:text-xl font-semibold">
					{title}
				</h2>
				{subtitle && (
					<p className="text-gray-400 text-xs sm:text-sm mt-1">{subtitle}</p>
				)}
			</div>
			{exploreHref && (
				<Link
					href={exploreHref}
					className="text-gray-300 hover:text-white text-xs sm:text-sm"
				>
					Explore All →
				</Link>
			)}
		</div>
	);
}


