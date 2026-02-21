"use client";

import React, { useState, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  Shield,
  Server,
  Workflow,
  Lock,
  Activity,
  Users,
  Stethoscope,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";

/* ---------------- NAV ---------------- */

const Nav = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50" style={{
      backgroundColor: 'rgba(251, 251, 249, 0.92)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border)'
    }}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Image
            src="/opax_logo.png"
            alt="Opax Logo"
            width={44}
            height={44}
            className="object-contain"
          />
          <span className="text-xl uppercase font-semibold" style={{ color: 'var(--color-sage-900)', letterSpacing: '0.2em' }}>
            OPAX
          </span>
        </div>
        <div className="flex gap-8 text-xs uppercase tracking-widest" style={{ color: 'var(--color-text-secondary)' }}>
          <a href="#protocol" style={{ transition: 'color 0.3s' }} onMouseOver={e => e.currentTarget.style.color = 'var(--color-sage-700)'} onMouseOut={e => e.currentTarget.style.color = 'var(--color-text-secondary)'}>Protocol</a>
          <a href="#capability" style={{ transition: 'color 0.3s' }} onMouseOver={e => e.currentTarget.style.color = 'var(--color-sage-700)'} onMouseOut={e => e.currentTarget.style.color = 'var(--color-text-secondary)'}>Capability</a>
          <a href="#contact" style={{ transition: 'color 0.3s' }} onMouseOver={e => e.currentTarget.style.color = 'var(--color-sage-700)'} onMouseOut={e => e.currentTarget.style.color = 'var(--color-text-secondary)'}>Access</a>
        </div>
      </div>
    </nav>
  );
};

/* ---------------- HERO ---------------- */

const Hero = () => (
  <section className="pt-44 pb-32 text-center" style={{ backgroundColor: 'var(--color-background)' }}>
    <div className="max-w-5xl mx-auto px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        className="mb-12"
      >
        <Image
          src="/opax_logo.png"
          alt="Opax Machine"
          width={120}
          height={120}
          className="mx-auto logo-float"
          style={{ filter: 'drop-shadow(0 8px 30px rgba(93, 133, 112, 0.25))' }}
        />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.8 }}
        className="font-light tracking-tight"
        style={{ color: 'var(--color-text-primary)', fontSize: 'clamp(3rem, 10vw, 8rem)', lineHeight: 0.9 }}
      >
        Clinical <br />
        <span className="text-gradient" style={{ fontStyle: 'italic' }}>Intelligence</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.8 }}
        className="max-w-xl mx-auto mt-10 text-lg leading-relaxed"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        Opax Machine is a local-first AI system for healthcare.
        It connects internal tools and executes real clinical workflows using natural language — without sending patient data to the cloud.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.8 }}
        className="mt-12 flex justify-center gap-6 flex-wrap"
      >
        <button className="btn-primary px-10 py-4 uppercase text-xs font-medium" style={{ letterSpacing: '0.25em' }}>
          Request Demo
        </button>
        <button className="btn-secondary text-xs uppercase tracking-widest flex items-center gap-2 py-4 px-6">
          View Architecture <ChevronRight size={14} />
        </button>
      </motion.div>
    </div>
  </section>
);

/* ---------------- STATS ---------------- */

const Stats = () => {
  const stats = [
    { icon: Activity, value: "42%", label: "Reduction in Workflow Time" },
    { icon: Lock, value: "0", label: "PHI Sent to Cloud" },
    { icon: Users, value: "3.2x", label: "Clinician Throughput" },
  ];

  return (
    <section className="py-20" style={{ borderTop: '1px solid var(--border)' }}>
      <div
        className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3"
        style={{ backgroundColor: 'var(--border)', gap: '1px', border: '1px solid var(--border)' }}
      >
        {stats.map((s, i) => (
          <motion.div
            key={i}
            className="p-12 text-center"
            style={{ backgroundColor: 'var(--color-surface)' }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.6 }}
            viewport={{ once: true }}
          >
            <s.icon className="mx-auto mb-5" size={28} style={{ color: 'var(--color-sage-500)' }} />
            <div className="text-5xl font-light mb-3" style={{ color: 'var(--color-sage-900)' }}>{s.value}</div>
            <div className="text-xs uppercase tracking-widest" style={{ color: 'var(--color-text-secondary)' }}>
              {s.label}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

/* ---------------- TEXT REVEAL ---------------- */

const TextReveal = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const text = "Healthcare should never be forced to choose between innovation and privacy. Opax exists to prove both can coexist.";
  const words = text.split(" ");

  return (
    <section
      ref={ref}
      className="py-40"
      style={{
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'var(--color-sage-50)'
      }}
    >
      <div className="max-w-4xl mx-auto text-center px-6">
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-5xl font-light" style={{ lineHeight: 1.2 }}>
          {words.map((word, i) => {
            const start = i / words.length;
            const end = (i + 1) / words.length;
            return <TextWord key={i} word={word} progress={scrollYProgress} start={start} end={end} />;
          })}
        </div>
      </div>
    </section>
  );
};

const TextWord = ({ word, progress, start, end }: { word: string; progress: any; start: number; end: number }) => {
  const opacity = useTransform(progress, [start, end], [0.15, 1]);
  return <motion.span style={{ opacity, color: 'var(--color-sage-900)' }}>{word}</motion.span>;
};

/* ---------------- WORKFLOW ---------------- */

const WorkflowSection = () => {
  const steps = [
    {
      title: "Clinical Prompt",
      desc: "Doctors speak naturally: scheduling, labs, notes, coordination.",
      bullets: ["Voice or text", "No training required", "Natural phrasing"],
      icon: Stethoscope,
    },
    {
      title: "Local Intelligence",
      desc: "Opax processes intent entirely on-device using fine-tuned models.",
      bullets: ["No cloud inference", "No PHI exfiltration", "Sub-second reasoning"],
      icon: Server,
    },
    {
      title: "Tool Orchestration",
      desc: "Executes across EHR, lab, staff, scheduling, internal systems.",
      bullets: ["Modular connectors", "Structured actions", "Audit logs"],
      icon: Workflow,
    },
  ];

  const [active, setActive] = useState(0);

  return (
    <section id="protocol" className="py-28" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16">
        <div>
          <motion.h2
            className="font-light mb-16"
            style={{ fontSize: 'clamp(3rem, 8vw, 6rem)', lineHeight: 0.9 }}
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <span style={{ color: 'var(--color-text-primary)' }}>The</span>{" "}
            <span style={{ color: 'var(--color-sage-100)' }}>System</span>
          </motion.h2>

          {steps.map((s, i) => (
            <motion.div
              key={i}
              onClick={() => setActive(i)}
              className="py-8 cursor-pointer"
              style={{
                opacity: active === i ? 1 : 0.4,
                borderBottom: i < steps.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'opacity 0.3s'
              }}
            >
              <div className="flex gap-6">
                <span className="font-mono text-sm" style={{ color: 'var(--color-sage-500)' }}>0{i + 1}</span>
                <div className="flex-1">
                  <h3 className="text-2xl md:text-3xl mb-3 font-light" style={{ color: 'var(--color-text-primary)' }}>
                    {s.title}
                  </h3>
                  {active === i && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      transition={{ duration: 0.3 }}
                    >
                      <p className="mb-5 max-w-md leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                        {s.desc}
                      </p>
                      <ul className="space-y-2 text-xs uppercase tracking-widest" style={{ color: 'var(--color-sage-700)' }}>
                        {s.bullets.map((b, bi) => (
                          <li key={bi} className="flex items-center gap-2">
                            <span style={{ color: 'var(--color-sage-500)' }}>→</span> {b}
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="flex items-center justify-center p-10"
          style={{ border: '1px solid var(--border)', backgroundColor: 'var(--color-surface)' }}
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <div className="text-center">
            <div className="mb-6">
              <Image src="/opax_logo.png" alt="Opax System" width={80} height={80} className="mx-auto opacity-50" />
            </div>
            <div className="text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--color-sage-500)' }}>
              System Status
            </div>
            <div className="text-2xl font-light mb-6" style={{ color: 'var(--color-text-primary)' }}>
              Synthesizing
            </div>
            <div className="w-64 mx-auto" style={{ height: '2px', backgroundColor: 'var(--border)' }}>
              <motion.div
                style={{ height: '100%', backgroundColor: 'var(--color-sage-500)' }}
                animate={{ width: ["0%", "100%"] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

/* ---------------- CAPABILITIES ---------------- */

const Capabilities = () => {
  const features = [
    { icon: Lock, title: "Privacy by Design", desc: "Runs fully offline. No PHI leaves your environment." },
    { icon: Shield, title: "Clinical Safety", desc: "Structured action cards, confirmations, auditability." },
    { icon: Server, title: "Local Infrastructure", desc: "Deployable on laptops, desktops, or on-prem hospital machines." },
    { icon: Workflow, title: "Interoperability", desc: "Modular connectors to EHRs, labs, scheduling, internal tools." },
  ];

  return (
    <section id="capability" className="py-28" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-7xl mx-auto px-6">
        <motion.h2
          className="text-5xl md:text-6xl font-light mb-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <span style={{ color: 'var(--color-text-primary)' }}>Clinical</span>{" "}
          <span className="text-gradient">Capabilities</span>
        </motion.h2>

        <div
          className="grid md:grid-cols-2 lg:grid-cols-4"
          style={{ backgroundColor: 'var(--border)', gap: '1px', border: '1px solid var(--border)' }}
        >
          {features.map((f, i) => (
            <motion.div
              key={i}
              className="capability-card p-10 text-center"
              style={{ backgroundColor: 'var(--color-surface)' }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              viewport={{ once: true }}
            >
              <f.icon className="mx-auto mb-5" size={28} style={{ color: 'var(--color-sage-500)' }} />
              <h3 className="text-lg font-medium mb-3" style={{ color: 'var(--color-text-primary)' }}>{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ---------------- CONTACT ---------------- */

const Contact = () => (
  <section id="contact" className="py-28" style={{ borderTop: '1px solid var(--border)' }}>
    <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
      >
        <h2 className="text-5xl md:text-6xl font-light mb-6">
          <span style={{ color: 'var(--color-text-primary)' }}>Request</span>{" "}
          <span style={{ color: 'var(--color-sage-100)' }}>Access</span>
        </h2>
        <p className="max-w-md leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          We are onboarding healthcare teams intentionally to ensure safe deployment,
          strong governance, and meaningful clinical impact.
        </p>
        <div className="mt-8 flex items-center gap-4">
          <Image src="/opax_logo.png" alt="Opax" width={48} height={48} className="opacity-50" />
          <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--color-text-secondary)' }}>
            Trusted by leading healthcare systems
          </span>
        </div>
      </motion.div>

      <motion.form
        className="glass-card p-10 space-y-8"
        initial={{ opacity: 0, x: 30 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
      >
        <input
          className="w-full py-4 bg-transparent outline-none"
          style={{ borderBottom: '1px solid var(--border)', color: 'var(--color-text-primary)' }}
          placeholder="Organization"
        />
        <input
          className="w-full py-4 bg-transparent outline-none"
          style={{ borderBottom: '1px solid var(--border)', color: 'var(--color-text-primary)' }}
          placeholder="Email"
        />
        <input
          className="w-full py-4 bg-transparent outline-none"
          style={{ borderBottom: '1px solid var(--border)', color: 'var(--color-text-primary)' }}
          placeholder="Use Case (optional)"
        />
        <button className="btn-primary w-full py-5 uppercase tracking-widest text-xs font-medium">
          Join Pilot Program
        </button>
      </motion.form>
    </div>
  </section>
);

/* ---------------- FOOTER ---------------- */

const Footer = () => (
  <footer className="py-12 text-center" style={{ borderTop: '1px solid var(--border)' }}>
    <div className="max-w-7xl mx-auto px-6">
      <div className="flex items-center justify-center gap-3 mb-6">
        <Image src="/opax_logo.png" alt="Opax" width={32} height={32} className="opacity-50" />
        <span className="text-xs uppercase" style={{ color: 'var(--color-text-secondary)', letterSpacing: '0.2em' }}>
          OPAX MACHINE
        </span>
      </div>
      <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--color-text-secondary)' }}>
        © 2026 — PRIVATE CLINICAL INTELLIGENCE
      </p>
    </div>
  </footer>
);

/* ---------------- PAGE ---------------- */

export default function OpaxLandingPage() {
  return (
    <div style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-text-primary)' }} className="min-h-screen">
      <Nav />
      <Hero />
      <Stats />
      <TextReveal />
      <WorkflowSection />
      <Capabilities />
      <Contact />
      <Footer />
    </div>
  );
}
