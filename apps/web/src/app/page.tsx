import { LandingCta } from "@/components/landing/cta";
import { LandingFeatures } from "@/components/landing/features";
import { LandingFooter } from "@/components/landing/footer";
import { LandingHero } from "@/components/landing/hero";
import { LandingNavbar } from "@/components/landing/navbar";

export default function Page() {
	return (
		<div className="flex min-h-svh flex-col">
			<LandingNavbar />
			<main className="flex-1">
				<LandingHero />
				<LandingFeatures />
				<LandingCta />
			</main>
			<LandingFooter />
		</div>
	);
}
