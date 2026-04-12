# Verifi – Project Context

## Overview
Verifi is a startup revenue verification platform similar to TrustMRR.
It allows founders to submit their startup, upload proof, and get verified.

## Tech Stack
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Supabase (Auth, Database, Storage)

## Core Features Implemented
- Google OAuth authentication
- Multi-step startup submission form
- File upload system (Supabase storage bucket: proofs)
- Leaderboard displaying startups
- Verification scoring system (confidence score)
- Admin moderation panel (approve/reject submissions)

## Database
Table: public.startup_submissions

Key fields:
- id
- name
- email
- startup_name
- website
- biz_type
- mrr
- arr
- payment_methods
- proof_url
- confidence_score
- verification_status
- created_at

## Storage
- Bucket: proofs
- Policies:
  - INSERT → allowed (authenticated)
  - SELECT → allowed (public)

## API Routes
- /api/startup-submissions → handles submission
- /api/startup-submissions/count → count endpoint
- /api/verify/razorpay → revenue verification via API
- /api/admin/review → admin moderation actions

## Verification Logic
- Score calculated based on:
  - Proof uploaded
  - Payment methods
  - Website + social links
  - MRR / ARR
  - Verified revenue (API)

## Current State
- Submission flow works
- File upload works
- Leaderboard working
- Admin panel working
- Basic verification scoring implemented

## Goal
Build a fully trusted startup revenue verification platform with:
- API-based verification (Stripe, Razorpay)
- Automated scoring
- Fraud detection
- Public trust layer
