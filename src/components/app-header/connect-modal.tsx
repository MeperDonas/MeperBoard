"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ExternalLink, Shield, X } from "lucide-react";

import { GithubMark } from "./github-mark";
import { useAuth } from "./use-auth";

interface ConnectModalProps {
  onClose: () => void;
}

/**
 * Pre-authorization overlay that explains the permissions the GitHub App will
 * receive before the user is redirected to GitHub.
 *
 * The app requests read-only access to issues and pull requests in the repos
 * the user grants; it cannot write. A self-host fallback links to the PAT docs
 * (the functional PAT path is an external/ops concern, not wired here).
 */
export function ConnectModal({ onClose }: ConnectModalProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const { login } = useAuth();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Connect GitHub"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="relative z-10 w-full max-w-md rounded-2xl border bg-popover/95 p-6 text-popover-foreground shadow-2xl backdrop-blur-md ring-1 ring-border/50"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>

        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/30 ring-1 ring-primary/40">
          <GithubMark className="h-6 w-6" />
        </div>

        <h2 className="text-base font-semibold tracking-tight text-foreground">Connect GitHub</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          MeperBoard connects to GitHub to load the issues and pull requests for your repositories.
        </p>

        <div className="mt-4 flex items-start gap-2.5 rounded-lg border bg-card px-3 py-2.5">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Read-only access.</span> MeperBoard can read
            the issues and pull requests in the repositories you grant. It cannot write to them.
          </p>
        </div>

        <button
          type="button"
          onClick={login}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/30 transition-colors duration-150 hover:opacity-95"
        >
          <GithubMark className="h-4 w-4" />
          Authorize with GitHub
        </button>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
          Self-hosting?{" "}
          <a
            href="/self-host"
            className="inline-flex items-center gap-1 font-medium text-foreground underline decoration-border underline-offset-2 transition-colors hover:text-primary"
          >
            Read the self-host setup
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </p>
      </motion.div>
    </div>
  );
}
