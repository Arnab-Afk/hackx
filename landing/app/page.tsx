import { Navbar } from "@/components/Navbar"
import { Hero } from "@/components/Hero"
import { FeaturesGrid } from "@/components/FeaturesGrid"
import { ControlPlane } from "@/components/ControlPlane"
import { Testimonials } from "@/components/Testimonials"
import { PlatformOverview } from "@/components/PlatformOverview"
import { Footer } from "@/components/Footer"

export default function Home() {
  return (
    <div style={{ background: "#030303", color: "#fff", minHeight: "100vh" }}>
      <Navbar />
      <Hero />
      <FeaturesGrid />
      <ControlPlane />
      <Testimonials />
      <PlatformOverview />
      <Footer />
    </div>
  )
}

