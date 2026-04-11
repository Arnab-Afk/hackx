import { Navbar } from "@/components/Navbar"
import { Hero } from "@/components/Hero"
import { SectionDivider } from "@/components/SectionDivider"
import { FeaturesGrid } from "@/components/FeaturesGrid"
import { ControlPlane } from "@/components/ControlPlane"
import { Testimonials } from "@/components/Testimonials"
import { TechBand } from "@/components/TechBand"
import { FAQ } from "@/components/FAQ"
import { PlatformOverview } from "@/components/PlatformOverview"
import { FooterCTA } from "@/components/FooterCTA"
import { Footer } from "@/components/Footer"

export default function Home() {
  return (
    <div style={{ minHeight: "100vh" }}>
      <Navbar />
      <Hero />                            {/* dark */}
      <SectionDivider from="dark" />
      <FeaturesGrid />                    {/* light */}
      <SectionDivider from="light" />
      <ControlPlane />                    {/* dark */}
      <SectionDivider from="dark" />
      <Testimonials />                    {/* light */}
      <SectionDivider from="light" />
      <TechBand />                        {/* dark */}
      <SectionDivider from="dark" />
      <FAQ />                             {/* light */}
      <SectionDivider from="light" />
      <PlatformOverview />                {/* dark */}
      <FooterCTA />                       {/* dark */}
      <Footer />                          {/* dark */}
    </div>
  )
}

