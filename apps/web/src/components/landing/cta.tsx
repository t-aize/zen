import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingCta() {
	return (
		<section className="py-24 md:py-32">
			<div className="container mx-auto max-w-3xl px-4 text-center">
				<h2 className="mb-4 text-3xl font-bold md:text-4xl">
					Ready to bring zen to your server?
				</h2>
				<p className="mb-8 text-lg text-muted-foreground">
					Join thousands of communities already using Zen. Setup takes less than
					a minute.
				</p>
				<div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
					<Button size="lg" className="px-8" asChild>
						<Link href="#">
							Get Started
							<ArrowRightIcon className="ml-2 h-4 w-4" />
						</Link>
					</Button>
					<Button size="lg" variant="outline" asChild>
						<Link href="#">View Documentation</Link>
					</Button>
				</div>
			</div>
		</section>
	);
}
