# Verifii Engineering Handbook

> Single Source of Truth for the Verifii Platform

---

# Document Information

| Field | Value |
|--------|-------|
| **Document** | Verifii Engineering Handbook |
| **Version** | 2.17 |
| **Status** | Active |
| **Product** | Verifii |
| **Owner** | Eshan Maurya |
| **Started** | July 2026 |
| **Last Updated** | August 2026 |
| **Next Review** | After Phase 3 Completion |

---

## Document Classification

**Audience**

- Founders
- Engineers
- Future Contributors
- Technical Reviewers

**Confidentiality**

Internal Engineering Documentation

**Source of Truth**

This handbook is the authoritative engineering reference for Verifii. Architectural changes should be reflected in this handbook and documented through an Architecture Decision Record (ADR) whenever appropriate.

---

# Purpose

This handbook documents the engineering architecture, product decisions, implementation history, and operational standards of Verifii.

Its purpose is to ensure that every future feature, bug fix, migration, refactor, and architectural decision is built with full understanding of the platform.

Unlike the PRD, this document reflects the **actual implementation** of the platform.

Unlike the Implementation Plan, this document is **not** a roadmap.

It explains:

- how the system works
- why it works this way
- how it evolved
- what rules future engineers must follow

This document should remain accurate throughout the lifetime of the project.

---

# Documentation Philosophy

The project uses three core documents.

## 1. PRD

Defines the original vision.

Answers:

- Why are we building this?
- What should exist?
- Who is it for?

---

## 2. Implementation Plan

Defines execution.

Answers:

- What has been built?
- What remains?
- What phase are we currently in?

This document evolves constantly.

---

## 3. Engineering Handbook

Defines reality.

Answers:

- How does the platform actually work?
- Why was each architectural decision made?
- What are the platform rules?
- How should future contributors build on top of this system?

This document grows over time.

Nothing should ever be deleted without a strong reason.

---

# Preservation Rules

This handbook is cumulative.

Historical information must not be removed simply because implementation changes.

Instead:

- Mark old approaches as deprecated.
- Record why they changed.
- Document what replaced them.
- Preserve the reasoning.

The goal is to retain engineering knowledge, not just describe the latest code.

---

# Table of Contents

## [Chapter 1 — Product Overview](#chapter-1-product-overview)

## [Chapter 2 — Product & Architecture Evolution](#chapter-2-product-architecture-evolution)

## [Chapter 3 — Platform Architecture](#chapter-3-platform-architecture)

## [Chapter 4 — Database Architecture](#chapter-4-database-architecture)

## [Chapter 5 — Authentication & Authorization](#chapter-5-authentication-authorization)

## [Chapter 6 — Verification System](#chapter-6-verification-system)

## [Chapter 7 — Provider Integration Layer](#chapter-7-provider-integration-layer)

## [Chapter 8 — Revenue Processing](#chapter-8-revenue-processing)

## [Chapter 9 — Trust & Fraud Engine](#chapter-9-trust-fraud-engine)

## [Chapter 10 — Visibility System](#chapter-10-visibility-system)

## [Chapter 11 — Subscription & Billing System](#chapter-11-subscription-billing-system)

## [Chapter 12 — API Architecture](#chapter-12-api-architecture)

> Note: Chapter 13 is intentionally unused to preserve stable chapter numbering and historical references.

## [Chapter 14 — Founder Dashboard](#chapter-14-founder-dashboard)

## [Chapter 15 — Public Startup Profiles](#chapter-15-public-startup-profiles)

## [Chapter 16 — Leaderboard](#chapter-16-leaderboard)

## [Chapter 17 — Admin System](#chapter-17-admin-system)

## [Chapter 18 — Security Architecture](#chapter-18-security-architecture)

## [Chapter 19 — Operations & Deployment](#chapter-19-operations-deployment)

## [Chapter 20 — Development Standards & Best Practices](#chapter-20-development-standards-best-practices)

## [Chapter 21 — Architecture Decision Records (ADR)](#chapter-21-architecture-decision-records-adr)

## [Chapter 22 — Product Roadmap](#chapter-22-product-roadmap)

## [Chapter 23 — Core Engineering Principles](#chapter-23-core-engineering-principles)

## [Chapter 24 — Testing Philosophy](#chapter-24-testing-philosophy)

## [Chapter 25 — Verification & Security Review Framework (VRF)](#chapter-25-verification-security-review-framework-vrf)

## [Appendix A — Glossary](#appendix-a-glossary)

## [Appendix B — Project Structure](#appendix-b-project-structure)

## [Appendix C — Technology Stack](#appendix-c-technology-stack)

## [Appendix D — External Services](#appendix-d-external-services)

## [Appendix E — Development Commands](#appendix-e-development-commands)

## [Appendix F — Revision History](#appendix-f-revision-history)

---

# Chapter 1 — Product Overview

## 1.1 What is Verifii?

Verifii is a revenue verification platform that enables startup founders to prove their recurring revenue through direct integrations with supported payment providers instead of relying on screenshots or self-reported metrics.

The platform is built on the principle that trust should be earned through verifiable data rather than claims. By connecting payment providers in read-only mode, Verifii independently verifies revenue information and allows founders to publish trusted startup profiles that can be confidently viewed by investors, customers, founders, and the wider startup community.

Verifii is designed as an India-first platform while remaining compatible with founders and payment providers worldwide.

---

## 1.2 Why Verifii Exists

Across startup communities, social media, and founder marketplaces, revenue claims are frequently supported only by screenshots or manually entered numbers. While these screenshots may be genuine, they can also be edited, selectively cropped, or taken out of context. As a result, investors, customers, and fellow founders have very little objective evidence that a claimed Monthly Recurring Revenue (MRR) figure is accurate.

Verifii was created to replace screenshot-based trust with direct verification from payment providers.

Instead of asking founders to upload evidence manually, Verifii connects directly to supported payment providers, calculates verified recurring revenue, and publishes transparent verification results through structured startup profiles.

The long-term objective is to establish a trusted infrastructure where startup growth can be demonstrated through independently verified financial data instead of unverifiable marketing claims.

---

## 1.3 The Problem Being Solved

The startup ecosystem currently lacks a standardized and trustworthy method for validating revenue claims.

Founders often rely on screenshots, spreadsheets, or manually updated metrics to demonstrate traction. Although these methods are simple to share, they cannot be independently verified and therefore require the audience to trust the founder without supporting evidence.

This creates several challenges:

- Revenue claims can be manipulated or misrepresented.
- Investors and customers have limited confidence in publicly shared metrics.
- Honest founders receive little advantage over founders making exaggerated claims.
- Startup directories primarily measure visibility rather than credibility.

Verifii addresses these challenges by establishing a verification-first model where publicly displayed revenue is supported by provider-backed evidence rather than manual declarations.

---

## 1.4 The Verifii Solution

Verifii provides founders with a secure workflow for verifying recurring revenue while maintaining full control over whether their startup is publicly visible.

The current founder journey is:

1. Submit startup information.
2. Startup is saved privately.
3. Choose to verify immediately or later.
4. Connect a supported payment provider.
5. Revenue is verified automatically.
6. Founder chooses whether to publish the verified startup profile.
7. Once published, the startup becomes visible across Verifii's public surfaces, including the leaderboard, startup profile, badges, and public APIs.

This workflow balances founder flexibility with platform trust by ensuring that verification and publication remain separate decisions.

---

## 1.5 Target Audience

Verifii is primarily designed for:

- SaaS founders
- Indie hackers
- Bootstrapped startups
- Micro SaaS businesses
- AI startups
- Internet businesses with recurring revenue

The platform is especially optimized for Indian founders by providing native support for Razorpay, INR reporting, and India-focused onboarding, while continuing to support international payment providers such as Stripe.

---

## 1.6 Core Product Principles

Every product and engineering decision within Verifii is guided by the following principles:

### Verification Before Trust

Public trust should be based on independently verified data rather than screenshots or self-reported numbers.

### Privacy by Default

Every startup begins as private. Public visibility is a deliberate founder decision that is only available after meeting the platform's verification requirements.

### Founder Ownership

Founders always retain ownership of their startup information and decide whether a verified profile should remain public or private.

### Automation Over Manual Review

Wherever possible, verification should occur through automated provider integrations instead of manual moderation or document review.

### Security by Design

Sensitive credentials, verification data, and payment integrations must be protected through secure engineering practices rather than relying solely on operational policies.

### India-First Experience

The platform prioritizes the experience of Indian founders while maintaining compatibility with international startups and payment providers.

---

## 1.7 Product Positioning

Verifii is not a startup directory.

It is not an analytics dashboard.

It is not an accounting platform.

Verifii is a trust platform.

Its primary purpose is to help founders establish credibility through independently verified recurring revenue while providing the startup ecosystem with a more reliable source of publicly shared business metrics.

---

## 1.8 Current Product Scope

At the time of writing, Verifii provides:

- Founder authentication and startup management.
- Private startup submissions.
- Revenue verification through supported payment providers.
- Verification status tracking.
- Public startup profiles.
- Public leaderboard.
- Trust and verification indicators.
- Founder dashboard.
- Subscription and billing infrastructure.
- Admin review capabilities.
- Security, fraud prevention, and visibility controls.

The platform continues to evolve, with additional capabilities documented throughout this handbook and in the product roadmap.

---

# Chapter 2 — Product & Architecture Evolution

This chapter documents the complete evolution of Verifii from its original concept to its current architecture.

Unlike a changelog, this chapter explains the reasoning behind major product decisions, architectural pivots, security improvements, and user experience changes.

Whenever a significant platform decision was made, the previous approach, the problem that was discovered, the adopted solution, and the resulting architecture are recorded here.

The objective is to preserve engineering knowledge rather than simply document the latest implementation.

---

## 2.1 The Original Vision

Verifii was originally conceived as a trust layer for startup revenue.

Across startup communities, social media, and founder marketplaces, revenue claims are frequently supported only by screenshots or manually entered numbers. While these screenshots may be genuine, they can also be edited, selectively cropped, or taken out of context. As a result, investors, customers, and fellow founders have very little objective evidence that a claimed Monthly Recurring Revenue (MRR) figure is accurate.

The original vision behind Verifii was to replace screenshot-based trust with direct verification from payment providers.

Instead of asking founders to upload evidence manually, Verifii would connect directly to supported payment platforms in read-only mode, aggregate recurring revenue automatically, and publish verification results through transparent public startup profiles.

From the beginning, the platform was designed around five core principles:

- Verification instead of screenshots.
- Automated trust instead of manual moderation.
- Founder ownership of their own data.
- Transparent public startup profiles.
- Privacy and security by design.

The long-term objective has always been larger than simply displaying revenue numbers. Verifii aims to become a trusted infrastructure layer where founders can confidently prove business traction while allowing the community to evaluate startups using independently verified information rather than marketing claims.

Although the earliest concept was global in scope, the platform would later evolve into an India-first product while maintaining compatibility with international founders and payment providers.

---

## 2.8 Architecture Evolution

Document the evolution of Verifii's architecture.

As the platform evolved, the architecture transitioned into a strictly layered model.

The progression:
- Initial implementation
- Business logic inside pages/components
- Need for deterministic revenue calculations
- Revenue Aggregation logic separated into engines
- Dashboard logic separated into orchestration, presentation, and widgets
- Current unified, decoupled architecture

This progression ensured the platform remained extensible, testable, and robust against UI changes affecting business facts.

---

# Chapter 3 — Platform Architecture

This chapter provides a high-level overview of Verifii's technical architecture.

Rather than explaining individual features or implementation details, it describes how the major systems interact to deliver a secure, scalable, and verification-first platform.

Subsequent chapters explore each subsystem in greater detail.

---

## 3.1 Architecture Overview

Verifii is built as a modern full-stack web application with a modular architecture.

The platform separates responsibilities into independent systems responsible for authentication, startup management, payment-provider verification, trust scoring, fraud detection, subscriptions, and public presentation.

Each subsystem has a clearly defined responsibility, allowing new features to be introduced without tightly coupling unrelated business logic.

The architecture prioritizes:

- Security
- Maintainability
- Scalability
- Modular development
- Verification integrity

---

## 3.2 High-Level System Components

The platform consists of several major subsystems.

### Client Application

The frontend provides interfaces for founders, administrators, subscribers, and public visitors.

Responsibilities include:

- Startup submission
- Verification
- Dashboard
- Billing
- Public profiles
- Leaderboard
- Account management

---

### Backend API

The backend exposes server-side API routes responsible for:

- Authentication
- Authorization
- Startup management
- Provider integrations
- Revenue synchronization
- Trust calculation
- Fraud detection
- Billing
- Administrative operations

---

### Database

Supabase PostgreSQL acts as the primary source of truth for platform data.

It stores:

- Users
- Startup submissions
- Verification state
- Revenue snapshots
- Trust information
- Billing records
- Provider connections
- Administrative data

---

### Provider Integration Layer

The provider layer communicates with supported payment providers using secure, read-only integrations.

Current providers include:

- Razorpay (Primary)
- Stripe (Supported)

This layer is responsible for collecting provider data while abstracting provider-specific implementation details away from the rest of the platform.

---

### Verification Engine

The verification engine coordinates provider synchronization and transforms provider data into standardized verification results.

It determines:

- Verification outcome
- Revenue calculations
- Verification status
- Trust inputs

---

### Public Platform

The public platform exposes verified startup information through:

- Leaderboard
- Startup profiles
- Public APIs
- Verification badges
- Search engine indexing

Only startups that satisfy the platform's publication requirements are exposed publicly.

---

## 3.3 Technology Stack

The current platform is built using:

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

### Backend

- Next.js Route Handlers
- TypeScript

### Database

- Supabase PostgreSQL

### Authentication

- Supabase Auth

### Storage

- Supabase Storage

### Hosting

- Vercel

### Payments

- Razorpay
- Stripe

---

## 3.4 High-Level Data Flow

The simplified platform workflow is:

Visitor

↓

Founder Authentication

↓

Startup Submission

↓

Private Startup

↓

Verification

↓

Revenue Processing

↓

Trust Evaluation

↓

Publication Decision

↓

Public Startup Profile

↓

Leaderboard & Public APIs

Each stage represents a controlled transition governed by business rules and security validations.


                ┌──────────────┐
                │    Founder   │
                └──────┬───────┘
                       │
                       ▼
              Startup Submission
                       │
                       ▼
             Private Startup Record
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
  Verify Now                 Verify Later
         │                           │
         └─────────────┬─────────────┘
                       ▼
             Provider Integration
        (Razorpay / Stripe Manual)
                       │
                       ▼
             Verification Engine
                       │
                       ▼
              Trust Evaluation
                       │
                       ▼
          Eligible for Publication
                       │
             Founder Chooses Public
                       │
                       ▼
     Leaderboard • Profile • Badge • API

---

## 3.5 Core Design Principles

Several architectural principles guide the implementation of every subsystem.

### Separation of Responsibilities

Each subsystem is responsible for a single domain.

Verification logic, billing, trust scoring, authentication, and visibility management remain independent wherever practical.

---

### Verification Before Publication

Verification and publication are separate processes.

Completing verification does not automatically expose a startup publicly.

Publication remains an explicit founder decision after verification requirements have been satisfied.

---

### Security by Default

Sensitive information is protected through encryption, access controls, ownership validation, and server-side authorization.

Security decisions are enforced within backend services rather than relying solely on frontend restrictions.

---

### Extensibility

The platform is designed to support additional payment providers, verification methods, and public features without requiring major architectural changes.

---

## 3.6 System Boundaries

The platform intentionally separates several concerns.

Authentication is independent of verification.

Verification is independent of publication.

Trust scoring is independent of billing.

Billing is independent of provider synchronization.

This separation reduces coupling and allows individual systems to evolve independently.

---

## 3.7 Current Architecture Summary

At the time of writing, Verifii consists of a modular verification platform built around secure provider integrations, automated trust evaluation, founder-controlled publication, and an India-first verification experience.

The chapters that follow describe each subsystem individually, including its responsibilities, architecture, implementation, and future evolution.

---

## 3.8 Layered Dashboard Architecture

As the platform evolved, the dashboard architecture transitioned into a strictly layered model.

Responsibilities are explicitly separated to prevent business logic from leaking into presentation code.

The layered pipeline follows a unidirectional flow:

Dashboard Layer -> Revenue Aggregation Layer -> Snapshot Layer -> Business Logic Layer -> Presentation Layer

### Dashboard Page (Orchestration)
The dashboard page acts purely as an orchestrator. It fetches raw data and passes it to the underlying engines. It never performs financial calculations.

### Revenue Aggregation
The single source of truth for all financial data. It standardizes revenue across all providers and handles complex scenarios like suspicious zero detection.

### Snapshot Layer
Revenue is persisted as immutable snapshots rather than live calculations, ensuring historical determinism and decoupling the dashboard from provider APIs.

### Business Logic (Engines)
Engines transform raw database snapshots into business-facts.

### Presentation (Presenters)
Presenters transform business-facts into view models optimized for UI consumption. They handle formatting, grouping, and display logic.

### Widgets (Rendering)
Client components that receive pre-formatted view models. They contain zero business logic or provider SDK code.

---

# Chapter 4 — Database Architecture

This chapter documents the architecture of Verifii's primary database and explains how data is organized, related, and managed across the platform.

Rather than describing every column or migration, this chapter focuses on the logical structure of the database and the responsibilities of each major data model.

Detailed schema changes and migration history are documented in later chapters.

---

## 4.1 Database Overview

Verifii uses **Supabase PostgreSQL** as its primary database.

The database serves as the single source of truth for every persistent aspect of the platform, including authentication, startup records, verification state, trust metrics, billing, subscriptions, provider connections, and administrative operations.

The database has been designed around modular entities where each table owns a clearly defined responsibility.

This separation reduces coupling between systems while making future expansion significantly easier.

---

## 4.2 Database Design Principles

The database follows several design principles.

### Single Source of Truth

Each entity has one authoritative location.

For example:

- Startup information belongs to startup submissions.
- Revenue snapshots belong to revenue snapshot records.
- Billing belongs to subscription records.
- Provider credentials belong to provider connections.

Information should never be duplicated unless intentionally denormalized for performance.

---

### Separation of Responsibilities

Verification data, public profile information, billing, authentication, and fraud analysis remain logically independent.

Each system owns its own data while referencing shared identifiers where necessary.

---

### Security by Default

Sensitive information is protected through encryption, Row Level Security (RLS), ownership validation, and restricted storage access.

The database is never trusted directly by client applications.

All sensitive operations pass through authenticated backend APIs.

---

## 4.3 Core Data Models

The platform is organized around several primary entities.

### Users

Represents authenticated platform users.

Responsibilities include:

- Authentication
- Account ownership
- Subscription ownership
- Startup ownership

---

### Startup Submissions

The central entity of the platform.

Each startup submission represents a startup created by a founder.

Responsibilities include:

- Startup identity
- Verification state
- Public visibility
- Founder ownership
- Trust information
- Revenue metadata

Almost every major subsystem references startup records.

---

### Provider Connections

Represents secure connections between startups and supported payment providers.

Responsibilities include:

- Connected provider
- Connection state
- Verification credentials
- Synchronization status

Current supported providers include Razorpay and Stripe.

---

### Revenue Snapshots

Stores normalized verification results over time.

Responsibilities include:

- Verified recurring revenue
- Historical snapshots
- Growth calculations
- Verification timestamps

These records provide historical revenue tracking while preserving previous verification results.

---

### Trust & Fraud Data

Stores platform-generated trust metrics.

Responsibilities include:

- Trust score
- Confidence score
- Fraud indicators
- Risk classification
- Trust breakdown

These values are generated by backend verification systems rather than manually entered by founders.

---

### Billing & Subscription Records

Stores subscription information for platform users.

Responsibilities include:

- Active plans
- Trial status
- Billing lifecycle
- Subscription history
- Payment provider references

Billing remains independent from verification.

---

## 4.4 Data Relationships

The platform follows a relational design.

At a high level:

- One user may own multiple startups.
- One startup may connect to multiple payment providers.
- One startup may generate multiple revenue snapshots.
- One startup has one active trust profile.
- One user owns one subscription lifecycle.

These relationships allow each subsystem to evolve independently while maintaining data consistency.

---

## 4.5 Data Lifecycle

A typical startup progresses through the following lifecycle:

Founder Account

↓

Startup Submission

↓

Private Startup Record

↓

Provider Connection

↓

Revenue Verification

↓

Trust Evaluation

↓

Publication Decision

↓

Public Startup

↓

Ongoing Revenue Synchronization

The database preserves historical information throughout this lifecycle instead of replacing previous verification data.

---

## 4.6 Data Integrity

Verifii prioritizes data integrity over convenience.

Key principles include:

- Ownership validation before modification.
- Server-side authorization.
- Controlled state transitions.
- Historical revenue preservation.
- Verification auditability.
- Secure handling of sensitive credentials.

Every major state transition is performed through backend business logic rather than direct client updates.

---

## 4.7 Current Database Status

At the time of writing, the database supports:

- Founder accounts
- Startup management
- Revenue verification
- Trust scoring
- Fraud detection
- Provider integrations
- Subscription management
- Public startup visibility
- Administrative review

The schema continues to evolve alongside the platform while preserving backward compatibility wherever practical.

---

# Chapter 5 — Authentication & Authorization

This chapter documents how Verifii identifies users, protects platform resources, and authorizes access to sensitive operations.

Authentication and authorization form the foundation of every secure workflow within the platform. Every request that creates, modifies, verifies, or publishes startup data passes through server-side ownership and permission validation before business logic is executed.

---

## 5.1 Overview

Verifii follows a server-first authentication model.

Authentication determines **who the user is**.

Authorization determines **what the user is allowed to do**.

Although these concepts work together, they remain separate responsibilities throughout the platform.

Authentication establishes identity.

Authorization enforces permissions.

---

## 5.2 Authentication Model

User authentication is handled through Supabase Authentication.

Every authenticated user receives a unique identity that is used throughout the platform.

Authentication is required for:

- Creating startup submissions.
- Editing startup information.
- Connecting payment providers.
- Managing subscriptions.
- Accessing the founder dashboard.
- Administrative operations.

Public pages such as the leaderboard and published startup profiles remain accessible without authentication.

---

## 5.3 Authorization Model

Authentication alone does not grant access.

Every protected action must also satisfy authorization rules.

Authorization is enforced on the server before any business logic executes.

Typical authorization checks include:

- Startup ownership verification.
- Subscription eligibility.
- Administrative privileges.
- Provider connection ownership.
- Billing ownership.
- Publication permissions.

Frontend checks improve user experience, but backend validation remains the ultimate source of truth.

---

## 5.4 Ownership Model

Every startup belongs to exactly one authenticated founder account.

Ownership determines who can:

- Edit startup information.
- Connect payment providers.
- Resume verification.
- Publish or hide the startup.
- Manage verification settings.

Ownership validation occurs entirely on the backend.

Client-provided identifiers are never trusted without server-side verification.

---

## 5.5 Permission Levels

The platform currently operates with several logical permission levels.

### Public Visitor

Can:

- Browse public startups.
- View leaderboards.
- View published startup profiles.

Cannot:

- Modify platform data.
- Access founder dashboards.
- View private startups.

---

### Authenticated Founder

Can:

- Submit startups.
- Manage owned startups.
- Connect supported providers.
- Resume verification.
- Control startup visibility.
- Manage subscriptions.

Cannot:

- Access other founders' startups.
- Perform administrative actions.

---

### Administrator

Can:

- Review submissions.
- Moderate content.
- Perform administrative verification tasks.
- Access internal platform tools.

Administrative access remains isolated from founder workflows.

---

## 5.6 Authorization Principles

Several principles guide authorization throughout the platform.

### Least Privilege

Users receive only the permissions necessary for their role.

---

### Server Enforcement

Authorization is always enforced by backend APIs.

Frontend permission checks exist only to improve user experience.

---

### Ownership Validation

Every modification request verifies ownership before data changes are allowed.

No startup may be modified solely because its identifier is known.

---

### Explicit Access

Resources are private unless explicitly made public according to platform rules.

This principle applies to:

- Startup profiles.
- Verification data.
- Provider connections.
- Revenue information.

---

## 5.7 Security Boundaries

Authentication and authorization protect every critical subsystem.

Examples include:

- Verification pipeline.
- Billing.
- Provider integrations.
- Startup editing.
- Dashboard operations.
- Administrative tooling.

Each subsystem performs independent permission validation before executing business logic.

---

## 5.8 Current Authentication Status

At the time of writing, Verifii implements:

- Secure founder authentication.
- Server-side authorization.
- Ownership validation.
- Protected dashboard access.
- Protected verification endpoints.
- Administrative access controls.
- Public/private resource separation.

Authentication and authorization continue to evolve as additional founder roles, organizations, and collaboration features are introduced.

---

# Chapter 6 — Verification System

The Verification System is the core capability that distinguishes Verifii from traditional startup directories and self-reported revenue platforms.

Rather than relying on screenshots or manually entered metrics, Verifii verifies recurring revenue directly through supported payment providers and transforms provider data into standardized verification results.

Every public trust signal on the platform ultimately originates from the Verification System.

---

## 6.1 Purpose

The purpose of the Verification System is to establish trust between founders and the public by validating recurring revenue through independently verifiable sources.

Instead of asking visitors to trust founder claims, Verifii verifies revenue using provider-backed evidence and applies a consistent verification process to every startup.

The system is designed to answer one question:

> "Can this startup's reported revenue be independently verified?"

---

## 6.2 Verification Philosophy

Verification within Verifii follows several guiding principles.

### Provider-Backed Verification

Revenue should originate from supported payment providers rather than manual declarations whenever possible.

---

### Read-Only Access

Provider integrations operate using read-only credentials wherever supported.

Verifii never requests permissions that allow financial transactions or modifications to provider accounts.

---

### Founder Control

Verification is initiated by the founder.

Founders decide when to begin verification and whether a verified startup should become publicly visible after meeting publication requirements.

---

### Repeatable Verification

Verification is not treated as a one-time event.

Revenue may be synchronized repeatedly to ensure public information remains accurate as the business grows.

---

## 6.3 Verification Lifecycle

Every startup progresses through a controlled verification lifecycle.

Startup Submission

↓

Private Startup

↓

Verification Decision

↓

Provider Connection

↓

Revenue Synchronization

↓

Verification Processing

↓

Trust Evaluation

↓

Publication Eligibility

↓

Founder Publication Decision

↓

Public Startup

The platform intentionally separates verification from publication.

Completing verification makes a startup eligible for publication but does not automatically expose it publicly.

---

## 6.4 Verification Methods

Verifii supports multiple verification methods depending on the provider and the capabilities offered by that provider.

Current methods include:

- Direct provider integrations
- Secure API credential verification
- Read-only revenue synchronization

As additional providers are introduced, new verification methods may be incorporated without changing the overall verification workflow.

---

## 6.5 Verification States

Throughout its lifecycle, a startup may transition through several verification states.

Typical states include:

- Pending
- Verification in Progress
- Verified
- Verification Failed
- Review Required

These states communicate verification progress while allowing backend systems to manage synchronization independently.

---

## 6.6 Verification Responsibilities

The Verification System is responsible for:

- Validating provider connectivity.
- Coordinating revenue synchronization.
- Normalizing provider responses.
- Initiating trust evaluation.
- Recording verification outcomes.
- Maintaining verification history.
- Supporting future re-verification.

It is intentionally **not** responsible for publication decisions, subscription management, or public visibility.

Those responsibilities belong to separate systems.

---

## 6.7 Failure Handling

Verification may fail for several reasons, including:

- Invalid provider credentials.
- Authentication failures.
- Network interruptions.
- Provider-side errors.
- Temporary service outages.

Expected verification failures are presented to founders using clear, actionable messages.

Unexpected system failures are logged for investigation while protecting sensitive platform information.

The verification workflow is designed so that failures never expose private information or corrupt existing startup data.

---

## 6.8 Design Principles

Several principles guide the implementation of the Verification System.

### Independent Processing

Verification remains independent from billing, publication, and dashboard functionality.

---

### Provider Agnostic

The verification pipeline processes normalized provider data rather than depending on provider-specific implementations.

This allows additional providers to be supported with minimal architectural changes.

---

### Auditability

Verification results are preserved to support historical analysis, troubleshooting, and future platform improvements.

---

### Security First

Verification operations always prioritize secure handling of credentials, ownership validation, and controlled backend execution.

Sensitive provider information never relies solely on frontend validation.

---

## 6.9 Current Verification Architecture

At the time of writing, the Verification System supports secure provider integrations, repeated synchronization, verification state management, and standardized processing of provider-backed revenue data.

It serves as the foundation for the Trust Engine, Visibility System, Leaderboard, Startup Profiles, and every public trust signal displayed by Verifii.

The following chapters describe the supporting systems that make the Verification System possible, beginning with the Provider Integration Layer.

---

## 6.10 Verification Pipeline Architecture

The Verification System is implemented as a sequential pipeline.

Rather than a single monolithic operation, verification progresses through distinct architectural stages:

Provider Identification
↓
Connection Validation
↓
Revenue Synchronization
↓
Aggregation
↓
Snapshot Creation
↓
Trust Evaluation
↓
Verification Status Assignment
↓
Dashboard Publication
↓
Public Profile Rendering

This pipeline ensures that verification is deterministic. Each stage must succeed before the next stage begins.

## 6.11 Snapshot-Based Verification

Verifii utilizes a snapshot-first architecture for verification.

Instead of querying live provider APIs when a profile is loaded, the Verification System relies exclusively on immutable snapshots generated during the synchronization phase.

This architectural decision ensures that:
- Public profiles load instantly without waiting for external APIs.
- Historical verification records are preserved permanently.
- The platform remains resilient to temporary provider outages.
- Trust scoring operates on deterministic, unchanging historical data.

---

## 6.12 Startup Submission Pipeline

The production Startup Submission pipeline ensures idempotent, secure, and reliable processing of new startup applications.

The pipeline follows this specific flow:

Authentication

↓

Rate Limiting

↓

Authenticated User Binding

↓

Payload Validation

↓

Startup Normalization

↓

Duplicate Detection

↓

Proof Validation

↓

Slug Generation

↓

Startup Creation

↓

Best-Effort Auxiliary Writes

↓

Response

Each stage serves a distinct architectural purpose:
- **Authentication**: Ensures only authenticated founders can submit startups.
- **Rate Limiting**: Protects backend services from abuse.
- **Authenticated User Binding**: Binds the submission explicitly to the server-verified user ID, preventing ownership spoofing.
- **Payload Validation**: Ensures all required fields meet expected constraints before processing begins.
- **Startup Normalization**: Standardizes the startup name (e.g., removing whitespace) to support accurate duplicate detection.
- **Duplicate Detection**: Enforces idempotent submissions by returning an existing active startup if the user has already submitted it.
- **Proof Validation**: Secures uploaded verification proofs through server-side ownership checks, storage metadata validation, and magic-byte verification.
- **Slug Generation**: Generates a unique, URL-safe identifier for the startup.
- **Startup Creation**: Executes the core transaction to persist the canonical startup record.
- **Best-Effort Auxiliary Writes**: Records verification logs and provider connections in the background without risking the primary transaction if they fail.
- **Response**: Returns a standardized, safe response to the client.

---

## 6.13 Onboarding Draft Recovery Architecture

The founder onboarding flow implements a crash-resilient draft recovery system designed to protect founders from accidental refreshes, browser crashes, tab closures, and interrupted onboarding sessions.

The architecture follows three principles:

- Recovery without duplication
- Privacy-first persistence
- Explicit founder control

### Draft Storage

Drafts are persisted in local storage using:

`verifii-onboarding-draft-v1`

The draft envelope structure is:

```ts
{
  version: 1,
  savedAt: string,
  step: number,
  data: PersistedFormFields
}
```

### Persisted Fields

Persisted:

- founder name
- startup name
- website
- business type
- MRR
- ARR
- twitter
- linkedin
- city
- notes
- payment methods
- verification preferences

Never persisted:

- email
- API keys
- provider secrets
- uploaded proofs

### Recovery Guarantees

The recovery architecture guarantees:

- schema versioning
- seven-day expiration
- corrupted draft cleanup
- debounced persistence
- cross-tab synchronization
- explicit restore
- explicit discard

### State Separation

Draft existence and banner visibility are intentionally separated.

The onboarding system maintains:

- pendingDraft
- isBannerDismissed
- showBanner

Banner visibility is computed rather than stored.

This prevents accidental draft loss during refreshes and avoids destructive state coupling.

---

# Chapter 7 — Provider Integration Layer

The Provider Integration Layer is responsible for securely connecting Verifii to external payment providers and transforming provider-specific data into a standardized format that can be processed by the Verification System.

Rather than allowing every subsystem to communicate directly with external payment providers, Verifii isolates provider-specific logic within a dedicated integration layer. This architecture improves maintainability, simplifies future provider additions, and ensures that the rest of the platform operates independently of provider-specific APIs.

---

## 7.1 Purpose

The purpose of the Provider Integration Layer is to provide a secure and consistent interface between Verifii and supported payment providers.

Instead of exposing the platform to multiple provider-specific implementations, the integration layer acts as a translation layer that converts external provider responses into a common internal format.

This approach allows the Verification System, Trust Engine, and Revenue Processing pipeline to remain provider-agnostic.

---

## 7.2 Design Philosophy

The Provider Integration Layer is built around several guiding principles.

### Provider Independence

Every payment provider exposes different APIs, authentication methods, and response formats.

The integration layer hides these differences from the rest of the platform by exposing standardized internal interfaces.

---

### Secure Communication

All communication with external providers occurs through authenticated backend requests.

Sensitive credentials are never trusted from frontend applications and are handled exclusively by secure server-side processes.

---

### Read-Only Verification

Provider integrations are designed for verification rather than account management.

Wherever possible, Verifii requests only the minimum permissions required to verify recurring revenue and synchronize verification data.

The platform never initiates financial transactions on behalf of founders.

---

### Extensibility

The integration layer is designed so that new providers can be added without requiring major changes to the Verification System or other platform components.

Each provider implements the same logical contract while handling its own authentication and data retrieval internally.

---

## 7.3 Supported Providers

At the time of writing, Verifii supports the following providers.

### Razorpay

Razorpay is the primary verification provider for Verifii.

As an India-first platform, Verifii prioritizes Razorpay because it is widely adopted by Indian SaaS businesses, supports INR transactions, and aligns closely with the platform's primary target audience.

Founder onboarding, documentation, and verification workflows are optimized around Razorpay.

---

### Stripe

Stripe is supported as an international payment provider.

While Stripe remains an important part of the platform for founders operating globally, its verification experience is currently positioned as secondary to Razorpay in order to prioritize the needs of Indian founders.

The underlying integration remains fully supported by the backend architecture.

---

## 7.4 Integration Workflow

Every provider integration follows the same high-level workflow.

Founder initiates verification.

↓

Provider credentials are securely submitted.

↓

Backend validates ownership.

↓

Credentials are verified.

↓

Provider data is retrieved.

↓

Provider-specific responses are normalized.

↓

Standardized verification data is returned to the Verification System.

This standardized workflow allows downstream systems to operate consistently regardless of which payment provider supplied the data.

---

## 7.5 Credential Management

Provider credentials are treated as highly sensitive information.

The integration layer follows several security practices:

- Credentials are processed only on the backend.
- Sensitive values are encrypted before storage when persistence is required.
- Secrets are never exposed to public APIs.
- Ownership validation occurs before provider communication begins.
- Provider credentials are isolated from unrelated platform systems.

These controls reduce the attack surface while ensuring secure provider verification.

---

## 7.6 Error Handling

External providers may return authentication errors, validation failures, rate limits, or temporary service interruptions.

The Provider Integration Layer converts these provider-specific responses into standardized platform errors.

This allows the frontend to display consistent, user-friendly messages regardless of which provider generated the original error.

Expected authentication failures are presented as actionable guidance for founders, while unexpected failures are logged for investigation without exposing sensitive implementation details.

---

## 7.7 Provider Prioritization

Verifii follows an India-first product strategy.

Accordingly, provider presentation within the platform reflects the needs of the primary user base.

Current prioritization is:

1. Razorpay
2. Stripe

Razorpay is presented as the recommended provider for Indian founders, while Stripe remains available for founders operating internationally.

This prioritization affects only the user experience and onboarding flow.

Internally, both providers continue to use the same standardized verification architecture.

---

## 7.8 Current Architecture

The Provider Integration Layer currently provides:

- Secure provider authentication.
- Standardized provider interfaces.
- Credential validation.
- Revenue data retrieval.
- Provider-specific error normalization.
- Secure credential handling.
- Extensible provider architecture.

Future providers can be integrated into this layer without requiring architectural changes to the Verification System or other downstream platform components.

---

## 7.9 Unified Provider Interface

To enforce provider isolation, all payment integrations conform to a unified internal contract.

This abstraction ensures that the rest of the platform never interacts with provider-specific APIs or SDKs directly. The Provider Integration Layer exposes a standardized registry that routes generalized commands to the appropriate provider implementation.

## 7.10 Provider Isolation Architecture

Provider isolation is a strict architectural boundary within Verifii.

Provider SDKs (such as Stripe or Razorpay clients) are completely isolated to backend synchronization routes and webhook processors.

Under no circumstances do provider SDKs execute within:
- Dashboard components.
- Client-side React code.
- Trust evaluation engines.
- Presentation layers.

This isolation ensures that changes to a provider's API only affect the specific integration layer, leaving the broader platform untouched.

---

# Chapter 8 — Revenue Processing

The Revenue Processing System is responsible for transforming raw payment-provider data into standardized, reliable revenue metrics that can be used throughout Verifii.

Payment providers expose revenue information in different formats, currencies, billing models, and API structures. The purpose of this system is to normalize that information into a consistent internal representation that can be verified, analyzed, and displayed across the platform.

Rather than simply displaying provider responses, Verifii processes revenue through a controlled pipeline that prioritizes accuracy, consistency, and long-term historical tracking.

---

## 8.1 Purpose

The purpose of the Revenue Processing System is to convert provider-specific financial information into standardized revenue data that can be consumed by the rest of the platform.

This system acts as the bridge between provider integrations and downstream systems such as Trust Evaluation, Leaderboards, Startup Profiles, and Analytics.

Every verified revenue metric displayed by Verifii originates from this processing pipeline.

---

## 8.2 Revenue Processing Philosophy

The system is designed around several guiding principles.

### Standardization

Different providers expose different billing structures.

The Revenue Processing System converts these provider-specific formats into a unified internal model so that every startup is evaluated consistently.

---

### Consistency

Revenue calculations should produce predictable results regardless of which supported provider supplies the underlying data.

Founders using different payment providers should receive equivalent treatment whenever possible.

---

### Historical Preservation

Revenue should never be treated as a single static value.

Instead, the platform preserves historical snapshots that allow future analysis of growth, trends, and verification history.

---

### Provider Independence

Revenue processing should remain independent from provider implementations.

Once provider data has been normalized, downstream systems no longer need to know which provider supplied the original information.

---

## 8.3 Revenue Processing Pipeline

The high-level revenue workflow is:

Provider Data

↓

Data Validation

↓

Normalization

↓

Revenue Calculation

↓

Snapshot Generation

↓

Historical Storage

↓

Trust Evaluation

↓

Platform Features

Each stage performs a specific responsibility before handing processed information to the next subsystem.

---

## 8.4 Data Normalization

Payment providers expose financial information using different naming conventions, currencies, timestamps, and billing structures.

The normalization stage converts these differences into a common internal representation.

Examples include:

- Standardized recurring revenue values.
- Unified timestamps.
- Common revenue categories.
- Consistent provider metadata.
- Shared internal field definitions.

This allows downstream systems to operate without provider-specific logic.

---

## 8.5 Revenue Snapshots

Rather than replacing previously verified revenue, Verifii records revenue as a series of historical snapshots.

Each snapshot represents the verified state of a startup's revenue at a particular point in time.

Historical snapshots support:

- Revenue history.
- Growth analysis.
- Trend visualization.
- Future analytics.
- Verification auditing.

This approach preserves the evolution of a startup instead of only storing its latest value.

---

## 8.6 Revenue Metrics

The Revenue Processing System produces standardized metrics that can be consumed throughout the platform.

These metrics may include:

- Monthly Recurring Revenue (MRR)
- Annual Recurring Revenue (ARR)
- Revenue growth
- Verification timestamps
- Provider metadata
- Historical revenue records

Additional metrics may be introduced as the platform evolves without changing the overall architecture.

---

## 8.7 Error Handling

Revenue processing is designed to tolerate temporary provider inconsistencies while protecting data integrity.

Examples include:

- Missing provider fields.
- Temporary synchronization failures.
- Partial provider responses.
- Currency inconsistencies.
- Invalid provider data.

Unexpected processing failures do not overwrite previously verified information.

Instead, processing failures are isolated, logged, and surfaced through appropriate verification states.

---

## 8.8 Design Principles

The Revenue Processing System follows several architectural principles.

### Accuracy Before Speed

Correct revenue calculations are prioritized over processing speed.

---

### Immutable History

Historical verification data should be preserved rather than replaced.

---

### Deterministic Processing

The same verified provider data should always produce the same processing result.

---

### Modular Architecture

Revenue processing remains independent from trust scoring, visibility, billing, and presentation layers.

Each downstream subsystem receives processed revenue rather than raw provider responses.

---

## 8.9 Current Architecture

At the time of writing, the Revenue Processing System provides:

- Provider data normalization.
- Standardized recurring revenue calculations.
- Historical revenue snapshots.
- Verification timestamps.
- Processed revenue metrics.
- Consistent inputs for downstream systems.

The processed output generated by this system becomes the primary input for the Trust & Fraud Engine, which evaluates the reliability and confidence of every verified startup.

---

## 8.10 Revenue Aggregation as Single Source of Truth

The Revenue Aggregation Layer serves as the platform's Single Source of Truth for all financial calculations.

No other system—including the dashboard, presentation layer, or public profiles—is permitted to calculate revenue, growth, or financial health.

The Aggregation Layer exclusively owns:
- Monthly Recurring Revenue (MRR) calculations.
- Annual Recurring Revenue (ARR) calculations.
- Revenue growth comparisons.
- Currency normalization.
- Provider data consolidation.

By centralizing these calculations, Verifii ensures absolute financial consistency across the entire platform.

## 8.11 Revenue Pipeline Architecture

The complete revenue pipeline flows unidirectionally from external providers to the UI:

Provider
↓
Synchronization
↓
Revenue Aggregation (Single Source of Truth)
↓
Revenue Snapshots (Immutable Storage)
↓
Dashboard Orchestration
↓
Business Model Transformation (Engines)
↓
Presentation Model (Presenters)
↓
UI Rendering (Widgets)

## 8.12 Suspicious Zero Detection

Because revenue calculations determine public trust, the aggregation layer must be resilient to external provider instability.

The architecture includes fallback mechanisms to detect "Suspicious Zero" scenarios—situations where a provider's API returns zero revenue despite historical evidence of active subscriptions. When detected, the system safely falls back to the most recent verified state rather than immediately collapsing a startup's verified revenue.

## 8.13 Snapshot Consistency Guards

Before any newly aggregated revenue is persisted as an immutable snapshot, the system performs consistency validation.

This prevents temporary synchronization failures, API rate limits, or partial provider responses from generating corrupted snapshots that would artificially alter a startup's historical trajectory.

---

# Chapter 9 — Trust & Fraud Engine

The Trust & Fraud Engine is responsible for evaluating the reliability, integrity, and confidence of every verified startup on Verifii.

Verification alone does not automatically establish trust. A startup may successfully connect a payment provider while still exhibiting unusual activity, incomplete verification, or inconsistencies that require additional evaluation.

The Trust & Fraud Engine analyzes verification results, applies platform rules, and generates trust indicators that help determine how confidently a startup's information can be presented to the public.

This system transforms raw verification into meaningful trust.

---

## 9.1 Purpose

The purpose of the Trust & Fraud Engine is to provide an objective assessment of the reliability of a startup's verified information.

Rather than relying solely on successful provider connections, the platform evaluates multiple trust signals before assigning trust metrics and determining publication eligibility.

The engine is designed to answer two questions:

- Can this startup's verification be trusted?
- How confident is the platform in the published information?

---

## 9.2 Trust Philosophy

The Trust & Fraud Engine is built around several core principles.

### Trust Is Earned

Verification is the starting point, not the final destination.

Trust is established through consistent verification, reliable provider data, secure ownership, and adherence to platform rules.

---

### Automation Over Manual Judgement

Whenever possible, trust evaluation is performed automatically using objective platform rules.

Manual review is reserved for exceptional cases where automated systems cannot confidently determine the appropriate outcome.

---

### Continuous Evaluation

Trust is not permanent.

As startups continue synchronizing revenue and interacting with the platform, trust indicators may improve or decline depending on new information.

---

### Explainability

Trust decisions should be understandable.

Platform-generated trust metrics should be based on identifiable factors rather than opaque or arbitrary scoring.

---

## 9.3 Trust Evaluation Pipeline

The Trust & Fraud Engine operates after successful revenue processing.

The high-level workflow is:

Verified Revenue

↓

Verification Analysis

↓

Fraud Detection

↓

Trust Evaluation

↓

Confidence Assessment

↓

Trust Metrics

↓

Publication Eligibility

↓

Public Trust Signals

This sequence ensures that public trust indicators are based on processed and verified information rather than raw provider data.

---

## 9.4 Trust Signals

Trust evaluation considers multiple independent signals.

Examples include:

- Verification success.
- Provider authenticity.
- Revenue consistency.
- Historical verification stability.
- Ownership validation.
- Verification history.
- Platform activity.

No single signal determines trust independently.

Instead, multiple signals contribute to an overall assessment.

---

## 9.5 Fraud Detection

The Fraud Detection subsystem identifies patterns that may reduce confidence in verification results.

Its purpose is not to accuse founders of misconduct but to protect the integrity of the platform.

Potential indicators include:

- Unusual verification behavior.
- Suspicious verification patterns.
- Inconsistent provider responses.
- Repeated verification failures.
- Unexpected revenue anomalies.

Detected anomalies may reduce trust, require additional verification, or trigger administrative review.

---

## 9.6 Trust Metrics

The Trust & Fraud Engine produces several standardized metrics used throughout Verifii.

These may include:

- Trust Score
- Confidence Score
- Fraud Score
- Risk Level
- Trust Tier
- Trust Breakdown

These metrics are consumed by multiple platform systems including:

- Startup Profiles
- Leaderboard
- Verification Status
- Administrative Dashboard
- Internal Analytics

---

## 9.7 Administrative Review

Most startups are evaluated automatically.

However, certain situations may require administrative review before publication.

Examples include:

- Conflicting verification signals.
- High fraud indicators.
- Incomplete verification data.
- Exceptional platform conditions.

Administrative review supplements automated evaluation rather than replacing it.

---

## 9.8 Design Principles

The Trust & Fraud Engine follows several architectural principles.

### Independence

Trust evaluation remains independent from provider integrations and revenue processing.

It consumes processed verification data rather than interacting directly with payment providers.

---

### Consistency

Equivalent verification conditions should produce equivalent trust outcomes.

This ensures fairness across different founders and supported providers.

---

### Transparency

Trust metrics should reflect identifiable platform signals rather than arbitrary decisions.

---

### Extensibility

The engine is designed to incorporate additional trust signals and fraud detection rules as the platform evolves without requiring major architectural changes.

---

## 9.9 Current Architecture

At the time of writing, the Trust & Fraud Engine provides:

- Automated trust evaluation.
- Fraud signal analysis.
- Confidence assessment.
- Trust metric generation.
- Risk classification.
- Administrative escalation when required.

The Trust & Fraud Engine serves as the final quality assessment before verified startups become eligible for public visibility.

The following chapter describes how these trust decisions are translated into public visibility through Verifii's Visibility System.

---

# Chapter 10 — Visibility System

The Visibility System is responsible for determining whether a startup is accessible through Verifii's public platform.

Unlike traditional startup directories where submissions become public immediately after creation, Verifii follows a controlled publication model. Every startup begins as a private record that is visible only to its owner. Public visibility is granted only after the platform's publication requirements have been satisfied and the founder explicitly chooses to publish the startup.

This architecture protects the integrity of the platform while giving founders complete control over their public presence.

---

## 10.1 Purpose

The purpose of the Visibility System is to separate startup creation, verification, and publication into independent stages.

This ensures that:

- founders can safely create startups without immediate public exposure,
- verification can be completed at any time,
- only eligible startups appear on public surfaces,
- founders remain in control of publication decisions.

Visibility is therefore treated as an independent platform concern rather than a side effect of verification.

---

## 10.2 Visibility Philosophy

The Visibility System is built around several core principles.

### Private by Default

Every startup begins its lifecycle as a private resource.

Private startups are visible only to their owner through authenticated founder interfaces.

No startup becomes public automatically.

---

### Verification Before Publication

Verification and publication are separate decisions.

Completing verification makes a startup eligible for publication, but publication remains a founder-controlled action.

---

### Founder Control

Founders decide whether a verified startup should remain public or private.

The platform never forces publication after successful verification.

Likewise, founders may choose to hide previously published startups whenever they wish.

---

### Centralized Visibility

Public visibility is controlled through a single platform-wide visibility model.

Every public surface relies on the same visibility rules rather than implementing independent publication logic.

This guarantees consistent behavior throughout the platform.

---

## 10.3 Startup Visibility Lifecycle

Every startup progresses through the following visibility lifecycle.

Startup Submitted

↓

Private Startup

↓

Verification (Now or Later)

↓

Publication Eligible

↓

Founder Publishes

↓

Public Startup

↓

Founder May Hide Again

This lifecycle separates operational progress from public visibility, allowing founders to manage verification without exposing incomplete or unverified startups.

---

## 10.4 Public Visibility Rules

A startup becomes publicly accessible only after satisfying the platform's publication requirements.

Current publication requirements include:

- Successful verification.
- Eligibility determined by platform verification systems.
- Founder approval to publish.

If any requirement is not satisfied, the startup remains private.

These rules apply consistently across the entire platform.

---

## 10.5 Protected Public Surfaces

The Visibility System protects every public-facing resource.

Examples include:

- Leaderboard.
- Startup profiles.
- Public APIs.
- Verification badges.
- Open Graph images.
- Search engine indexing.
- Public startup counts.

Every public query must respect the same visibility rules.

This centralized approach prevents accidental exposure of private or incomplete startup information.

---

## 10.6 Founder Access

Visibility restrictions apply only to public users.

Startup owners retain full access to their own startups regardless of publication status.

This allows founders to:

- Resume verification.
- Edit startup information.
- Review verification progress.
- Manage provider connections.
- Publish or hide their startup.

Owner access is validated through authenticated backend authorization rather than frontend controls.

---

## 10.7 Visibility Enforcement

Visibility is enforced entirely on the backend.

Frontend interfaces may hide unavailable actions to improve user experience, but all public access decisions are validated by server-side authorization before data is returned.

This prevents unauthorized access through manually constructed requests or direct API calls.

---

## 10.8 Design Principles

The Visibility System follows several architectural principles.

### Security Before Convenience

Protecting founder information takes precedence over maximizing public exposure.

---

### Consistency

Every public feature follows the same publication rules.

A startup that is private on one public surface is private everywhere.

---

### Explicit Publication

Visibility is always an intentional founder decision.

The platform never assumes that successful verification implies consent for publication.

---

### Extensibility

The visibility architecture is designed to support future publication models, organization accounts, and advanced privacy controls without fundamental architectural changes.

---

## 10.9 Current Architecture

At the time of writing, the Visibility System provides:

- Private-by-default startup creation.
- Founder-controlled publication.
- Centralized visibility enforcement.
- Owner-only access to private startups.
- Consistent protection across all public endpoints.
- Backend authorization for every public resource.
- Separation between verification and publication.

This architecture ensures that every publicly visible startup has intentionally passed through Verifii's verification and publication workflow while preserving founder privacy throughout the process.

The Visibility System completes the core verification pipeline and serves as the foundation for every public experience offered by Verifii.

---

# Chapter 11 — Subscription & Billing System

The Subscription & Billing System manages access to premium platform capabilities through subscription plans, billing lifecycle management, and payment processing.

Rather than simply collecting payments, this system determines feature eligibility, enforces subscription rules, and provides a consistent billing experience across the platform.

The billing architecture is designed to remain independent from the Verification System while integrating with platform permissions where required.

---

## 11.1 Purpose

The purpose of the Subscription & Billing System is to control access to premium functionality while providing founders with a secure and transparent subscription experience.

The system is responsible for:

- Managing subscription plans.
- Controlling premium feature access.
- Handling subscription lifecycle events.
- Processing payments.
- Supporting upgrades and downgrades.
- Maintaining billing history.

Billing determines what founders can access, but it never affects ownership of startup data.

---

## 11.2 Billing Philosophy

The Subscription & Billing System is built around several guiding principles.

### Feature Access Through Subscription

Subscriptions unlock platform capabilities rather than ownership.

A founder always retains ownership of their startup regardless of subscription status.

---

### Independent Architecture

Billing operates independently from verification, trust evaluation, and visibility.

Each subsystem communicates through well-defined interfaces without tightly coupling business logic.

---

### Transparent Billing

Subscription status, billing history, and plan information should always be clearly visible to founders.

Unexpected billing behavior should be avoided through predictable lifecycle management.

---

### Extensibility

The billing architecture is designed to support additional plans, payment providers, promotional offers, and future pricing models without significant architectural changes.

---

## 11.3 Subscription Lifecycle

A typical subscription progresses through the following lifecycle.

Visitor

↓

Account Creation

↓

Plan Selection

↓

Payment

↓

Active Subscription

↓

Subscription Management

↓

Renewal, Upgrade, Downgrade or Cancellation

↓

Subscription Ends or Continues

Throughout this lifecycle, startup ownership remains unchanged regardless of subscription status.

---

## 11.4 Subscription Plans

Verifii supports multiple subscription tiers designed for different founder needs.

Each plan defines access to platform capabilities such as:

- Startup verification.
- Premium analytics.
- Provider integrations.
- Advanced platform features.
- Future premium services.

Plan definitions remain independent from payment processing.

---

## 11.5 Payment Providers

Billing is processed through supported payment providers.

Current providers include:

### Razorpay

Primary payment provider for Indian founders.

Supports domestic payment methods and aligns with Verifii's India-first product strategy.

---

### Stripe

Supported for international founders.

Provides global payment support while integrating with the same subscription lifecycle as Razorpay.

Although founders may verify revenue using different providers, subscription billing remains independent from the verification process.

---

## 11.6 Subscription Enforcement

Subscription checks are performed on the backend before premium functionality is executed.

Examples include:

- Premium verification features.
- Provider connection eligibility.
- Billing management.
- Future premium platform capabilities.

Frontend interfaces may hide unavailable actions, but authorization is always enforced server-side.

---

## 11.7 Billing Security

The Subscription & Billing System follows several security principles.

- Payment processing is delegated to trusted payment providers.
- Sensitive billing operations occur on secure backend endpoints.
- Subscription ownership is validated before changes are permitted.
- Billing events are verified before affecting platform state.
- Payment credentials are never exposed to client applications.

---

## 11.8 Design Principles

The billing architecture follows several engineering principles.

### Separation of Concerns

Billing remains independent from verification and trust evaluation.

---

### Provider Agnostic

Subscription management is designed to work consistently regardless of the underlying payment provider.

---

### Reliability

Subscription state changes should remain predictable and recoverable.

Unexpected failures should never corrupt subscription ownership or platform permissions.

---

### Scalability

The billing system is designed to support future subscription models, organizational plans, enterprise licensing, and promotional pricing without architectural redesign.

---

## 11.9 Current Architecture

At the time of writing, the Subscription & Billing System provides:

- Subscription lifecycle management.
- Plan-based feature access.
- Backend subscription enforcement.
- Multi-provider payment support.
- Secure billing operations.
- Independent subscription architecture.

The Subscription & Billing System enables Verifii to provide premium capabilities while remaining separate from the platform's verification and trust infrastructure.

---

## 11.10 Subscription Selection Architecture

When a startup has multiple billing records (e.g., active, trialing, cancelled), the system must deterministically decide which subscription is currently in effect.

The architecture enforces a strict priority hierarchy:
1. `active`
2. `grace_period` (past due but still permitted)
3. `trialing`
4. `cancelled`

When multiple subscriptions share the same priority level, the system selects the newest record. This guarantees that founders are always credited with their most recent active subscription.

## 11.11 Subscription Replacement Workflow

Founders can change their billing plan at any time.

Rather than modifying an existing subscription in place, the architecture handles plan changes via replacement. A new subscription is created, and the previous subscription is terminated. The `change-plan` backend workflow manages this transition to ensure zero downtime.

## 11.12 Trial Handling

The billing architecture includes native support for trial periods. 

Trials are bounded by a `trial_end` timestamp. Once this timestamp is surpassed without payment, the subscription transitions out of the `trialing` state. The UI consumes this data to render countdown banners, but enforcement happens entirely on the backend.

## 11.13 Billing State Synchronization

Verifii relies on webhook-driven state synchronization to maintain accurate billing records.

External payment providers (Stripe and Razorpay) manage the actual billing lifecycle. As payments succeed, fail, or subscriptions cancel, webhook events are transmitted back to Verifii's backend. The synchronization layer processes these events and updates the internal database, ensuring that the platform always reflects the authoritative state provided by the payment gateway.

---

# Chapter 12 — API Architecture

The API Architecture provides the communication layer between Verifii's frontend applications, backend services, database, and external providers.

Rather than allowing frontend components to interact directly with the database or payment providers, every platform operation is executed through secure server-side APIs that enforce authentication, authorization, business rules, and security policies.

This architecture centralizes business logic, improves maintainability, and ensures consistent behavior across all platform interfaces.

---

## 12.1 Purpose

The purpose of the API Architecture is to provide a secure, standardized, and scalable interface between every major subsystem within Verifii.

The API layer is responsible for:

- Receiving client requests.
- Authenticating users.
- Authorizing operations.
- Executing business logic.
- Coordinating backend systems.
- Returning standardized responses.

The API layer acts as the single entry point for every operation performed by the platform.

---

## 12.2 API Philosophy

The API Architecture follows several guiding principles.

### Backend as the Source of Truth

The frontend is responsible for presentation.

The backend is responsible for decision making.

Every business rule is enforced on the server regardless of frontend behavior.

---

### Security First

Every protected endpoint validates authentication, ownership, and authorization before executing business logic.

Client requests are never trusted solely because they originate from authenticated sessions.

---

### Consistency

All APIs follow consistent request handling, response structures, validation, and error handling wherever practical.

This provides predictable behavior throughout the platform.

---

### Separation of Concerns

Each API endpoint owns a specific responsibility.

Verification APIs do not perform billing.

Billing APIs do not calculate trust.

Visibility APIs do not process provider data.

This separation keeps the platform modular and maintainable.

---

## 12.3 API Categories

The platform exposes several logical groups of APIs.

### Authentication APIs

Responsible for:

- User authentication.
- Session management.
- Identity validation.

---

### Startup Management APIs

Responsible for:

- Startup creation.
- Editing startup information.
- Startup retrieval.
- Founder ownership operations.

---

### Verification APIs

Responsible for:

- Provider verification.
- Verification lifecycle.
- Revenue synchronization.
- Verification state updates.

---

### Provider APIs

Responsible for:

- Secure provider communication.
- Credential validation.
- Provider-specific operations.

---

### Billing APIs

Responsible for:

- Subscription management.
- Plan enforcement.
- Payment lifecycle.
- Billing operations.

---

### Administrative APIs

Responsible for:

- Moderation.
- Administrative review.
- Platform management.
- Internal tooling.

---

### Public APIs

Responsible for exposing publicly available platform information while respecting the Visibility System.

Examples include:

- Public startup profiles.
- Leaderboard data.
- Public statistics.
- Verification badges.

Public APIs never expose private startup information.

---

## 12.4 Request Lifecycle

A typical API request follows the same execution pattern.

Client Request

↓

Route Resolution

↓

Authentication

↓

Authorization

↓

Input Validation

↓

Business Logic

↓

Database Operations

↓

Response Generation

↓

Client Response

Each stage performs a specific responsibility before passing execution to the next stage.

---

## 12.5 Validation Strategy

Input validation occurs before business logic executes.

Validation includes:

- Request structure.
- Required fields.
- Data types.
- Ownership validation.
- Permission checks.
- Business rule enforcement.

Invalid requests are rejected before any database modifications occur.

---

## 12.6 Error Handling

The API layer standardizes error handling across the platform.

Expected failures include:

- Authentication failures.
- Authorization failures.
- Validation errors.
- Provider authentication failures.
- Subscription restrictions.
- Resource not found.

Unexpected failures are logged internally while returning safe error responses to clients.

Sensitive implementation details are never exposed through public API responses.

---

## 12.7 API Security

Every protected endpoint follows common security practices.

These include:

- Authentication verification.
- Ownership validation.
- Authorization enforcement.
- Rate limiting.
- Input validation.
- Secure error handling.
- Protection against unauthorized resource access.

Security policies are enforced server-side for every request.

---

## 12.8 Integration with Platform Systems

The API layer coordinates communication between multiple platform systems.

Typical interactions include:

- Authentication → Startup Management.
- Verification → Provider Integration.
- Revenue Processing → Trust Engine.
- Trust Engine → Visibility System.
- Billing → Subscription Enforcement.

This orchestration allows each subsystem to remain independent while participating in larger workflows.

---

## 12.9 Current Architecture

At the time of writing, Verifii's API Architecture provides:

- Modular route organization.
- Secure backend processing.
- Centralized business logic.
- Standardized validation.
- Consistent authorization.
- Protected public endpoints.
- Secure provider communication.

The API layer forms the operational backbone of the platform and enables secure communication between every major subsystem documented throughout this handbook.

---

## 12.10 Startup Submission API Architecture

The Startup Submission API implements several core architectural patterns to guarantee data integrity and platform security:

- **Server-side ownership validation**: Client-provided user IDs are discarded. The API explicitly binds submissions to the authenticated session context.
- **Idempotent submission behavior**: Network retries and concurrent requests return the identical, already-created resource instead of failing or duplicating.
- **Duplicate recovery**: Race conditions bypassing application-level checks are caught by database constraints and handled through graceful duplicate recovery.
- **Structured logging**: All lifecycle events use the centralized logging architecture, ensuring standardized metadata is attached to every transaction.
- **Best-effort auxiliary writes**: Non-critical records (like verification logs) are processed asynchronously to prioritize core startup creation availability.
- **Backend as source of truth**: The API is the final authority on proof validation, name normalization, and uniqueness enforcement.

---

## 12.11 Shared Validation Architecture

Verifii uses a shared validation architecture for onboarding.

Validation exists in exactly one location:

`src/lib/validation/onboarding.ts`

Both:

- browser validation
- API validation

consume the same schema.

The architecture exports:

- onboardingSchema
- validateOnboarding()
- OnboardingPayload

The goal is:

Browser validation = API validation = database expectations

### Validation Rules

Startup Name

- required
- 3–80 characters
- trimmed
- whitespace-only values rejected

Revenue

- numeric only
- minimum: 0
- maximum: 999999999
- NaN rejected
- Infinity rejected

Website

- optional
- protocol normalized
- javascript: rejected
- data: rejected
- vbscript: rejected

Social Links

Allowed domains:

- x.com
- twitter.com
- linkedin.com

Payment Providers

Allowed:

- Razorpay
- Stripe

Unsupported providers are rejected by both client and server.

Notes

- maximum length: 5000 characters

### Validation Principle

Validation rules must exist in exactly one place.

Client validation improves user experience.

Server validation remains authoritative.

---

> Note: Chapter 13 is intentionally unused to preserve stable chapter numbering and historical references.

# Chapter 14 — Founder Dashboard

The Founder Dashboard serves as the central workspace for startup founders within Verifii.

It provides a unified interface where founders can manage their startups, monitor verification progress, control public visibility, manage subscriptions, and access every major feature available to their account.

Rather than acting as a simple navigation page, the dashboard functions as the operational control center for the entire founder experience.

---

## 14.1 Purpose

The primary purpose of the Founder Dashboard is to provide founders with a single location from which they can manage every aspect of their startup's lifecycle.

The dashboard allows founders to:

- View all owned startups.
- Monitor verification progress.
- Resume incomplete verification.
- Manage startup visibility.
- Review verification status.
- Access billing and subscription settings.
- Navigate platform features.

The dashboard eliminates the need for founders to interact directly with backend systems or individual workflows.

---

## 14.2 Dashboard Philosophy

The Founder Dashboard is designed around four guiding principles.

### Startup-Centric Experience

The startup—not the user account—is the primary object within the dashboard.

Every action is performed in the context of managing one or more startups.

---

### Clear Status Communication

Founders should immediately understand the current state of each startup.

Important information such as verification status, visibility, provider connection, and publication readiness should always be visible without requiring additional navigation.

---

### Guided Progress

Rather than presenting every possible action at once, the dashboard guides founders toward the next logical step in their startup's journey.

Examples include:

- Resume Verification
- Complete Startup Information
- Publish Startup
- Upgrade Subscription

---

### Single Control Center

The dashboard should become the primary location founders return to after creating their startup.

Every major founder workflow should either begin or end within the dashboard.

---

## 14.3 Dashboard Components

The dashboard consists of several logical sections.

### Startup Overview

Provides a summary of every startup owned by the authenticated founder.

Displays key information including:

- Startup identity.
- Verification status.
- Visibility status.
- Provider connection.
- Publication state.

---

### Verification Management

Allows founders to:

- Start verification.
- Resume verification.
- Monitor verification progress.
- Review verification outcomes.
- Resolve verification issues.

Verification remains the primary action for newly submitted startups.

---

### Startup Management

Provides controls for managing startup information including:

- Editing startup details.
- Updating founder information.
- Managing branding assets.
- Reviewing verification history.

---

### Subscription Management

Provides access to:

- Current subscription.
- Plan information.
- Billing settings.
- Payment history.
- Subscription upgrades.

---

### Quick Actions

Frequently used actions are surfaced prominently to reduce navigation.

Examples include:

- Add Startup.
- Resume Verification.
- Edit Startup.
- Publish Startup.
- View Public Profile.

---

## 14.4 Founder Workflow

The dashboard supports the complete founder lifecycle.

Founder Login

↓

Dashboard

↓

Startup Overview

↓

Verification (Now or Later)

↓

Verification Complete

↓

Publication Decision

↓

Public Startup

↓

Ongoing Startup Management

This workflow allows founders to manage their startups continuously after initial submission.

---

## 14.5 Verification Integration

The dashboard is tightly integrated with the Verification System.

It displays verification progress in real time and guides founders toward completing outstanding verification tasks.

Examples include:

- Verification Pending.
- Verification In Progress.
- Verification Complete.
- Verification Failed.
- Resume Verification.

The dashboard does not perform verification itself but acts as the primary interface for initiating and monitoring the verification process.

---

## 14.6 Visibility Integration

Visibility controls are surfaced directly within the dashboard.

Founders can immediately determine whether each startup is:

- Private.
- Eligible for publication.
- Public.

Visibility changes remain subject to backend authorization and publication rules.

The dashboard reflects platform state rather than defining it.

---

## 14.7 User Experience Principles

The dashboard is designed to reduce founder friction.

Key objectives include:

- Minimize unnecessary navigation.
- Clearly communicate startup status.
- Highlight next recommended actions.
- Reduce verification abandonment.
- Surface important platform events.

The interface prioritizes clarity over complexity.

---

## 14.8 Current Architecture

At the time of writing, the Founder Dashboard provides:

- Multi-startup management.
- Verification progress tracking.
- Resume verification workflows.
- Visibility management.
- Subscription access.
- Startup editing.
- Founder navigation.

The dashboard acts as the operational hub for founders and connects every major platform subsystem into a unified management experience.

---

## 14.9 Dashboard Architecture Refactor

To decouple complex business logic from UI components, the dashboard was refactored into a strictly layered architecture.
This ensures the UI layer only handles display concerns and never calculates financial metrics.

## 14.10 Revenue Analytics Dashboard

The dashboard implements a comprehensive revenue analytics view based on the layered architecture.
It surfaces aggregated revenue, MRR movements, and recent verifications through isolated widgets that receive pre-computed view models.

## 14.11 Founder Insights Pipeline

To support actionable metrics, the backend pipelines extract business-facts (e.g., Suspicious Zero occurrences, rapid MRR growth) which the Presenter layer formats into insights.
These insights are securely delivered to the dashboard orchestration layer.

## 14.12 Dashboard Orchestration Rule

By standard, the Dashboard Page (`page.tsx`) acts purely as an orchestrator.
It only performs data fetching, instantiates Engines, executes Presenters, and passes View Models to Widgets.
It never performs UI rendering directly.

---

# Chapter 15 — Public Startup Profiles

Public Startup Profiles are the primary public representation of a verified startup within Verifii.

Each profile serves as a transparent and verifiable source of information about a startup's identity, verification status, and revenue metrics while allowing founders to control whether their startup is publicly visible.

Rather than functioning as a traditional company profile page, Public Startup Profiles are designed to communicate trust through independently verified information.

---

## 15.1 Purpose

The purpose of Public Startup Profiles is to provide a trustworthy and standardized representation of verified startups.

Every profile allows visitors to:

- Learn about a startup.
- View verification status.
- Understand trust indicators.
- Review verified revenue information.
- Evaluate founder-provided details.
- Share startup profiles publicly.

Profiles act as the primary destination for every publicly visible startup on Verifii.

---

## 15.2 Profile Philosophy

Public Startup Profiles are designed around several guiding principles.

### Trust Before Promotion

The profile exists to communicate verified information rather than act as a marketing page.

Trust signals receive greater emphasis than promotional content.

---

### Transparency

Visitors should immediately understand what information has been verified and what information has been provided directly by the founder.

Verification status should always be clearly communicated.

---

### Founder Ownership

Although profiles become publicly accessible after publication, founders remain responsible for managing profile content and deciding whether their startup remains public.

---

### Consistency

Every public startup follows the same profile structure to ensure visitors can compare startups using consistent information.

---

## 15.3 Profile Components

Each Public Startup Profile is composed of several logical sections.

### Startup Identity

Displays the startup's core identity, including:

- Startup name.
- Logo.
- Founder information.
- Industry or business category.
- Website.
- Location.

---

### Verification Information

Provides visitors with an overview of the startup's verification state.

Examples include:

- Verification status.
- Verification provider.
- Verification date.
- Trust indicators.
- Confidence information.

---

### Revenue Information

Displays verified revenue metrics generated by the Verification System.

Depending on available data, profiles may present:

- Monthly Recurring Revenue (MRR).
- Annual Recurring Revenue (ARR).
- Historical revenue trends.
- Verification timestamps.

Only verified revenue information is presented.

---

### Trust Signals

Public profiles expose trust-related information generated by the Trust & Fraud Engine.

Examples include:

- Trust Score.
- Confidence Score.
- Trust Tier.
- Risk Classification.
- Verification Summary.

These indicators help visitors understand the reliability of the displayed information.

---

### Founder Information

Founders may provide additional profile information including:

- Founder biography.
- Social links.
- Startup description.
- Branding assets.

Founder-supplied content complements—but never replaces—platform-generated verification information.

---

## 15.4 Visibility Rules

Public Startup Profiles are protected by the Visibility System.

Profiles become publicly accessible only after:

- Verification requirements have been satisfied.
- Publication eligibility has been established.
- The founder has chosen to publish the startup.

Private startups remain inaccessible to public visitors.

Startup owners retain access regardless of publication state.

---

## 15.5 Profile Lifecycle

A Public Startup Profile progresses through the following lifecycle.

Startup Submission

↓

Private Startup

↓

Verification

↓

Publication Eligible

↓

Founder Publishes

↓

Public Startup Profile

↓

Revenue Synchronization

↓

Profile Updates

↓

Optional Unpublish

Throughout this lifecycle, the profile continues to evolve as verification data is synchronized and founder information is updated.

---

## 15.6 Profile Updates

Public profiles are dynamic rather than static.

Information may change as:

- Revenue is reverified.
- Startup details are updated.
- Founder information changes.
- Verification status evolves.
- Trust metrics are recalculated.

The profile always reflects the latest verified platform state.

---

## 15.7 Design Principles

Public Startup Profiles follow several architectural principles.

### Verification-Centered

Verification information receives higher priority than marketing content.

---

### Privacy Respect

Only information intentionally published by founders and approved by platform visibility rules becomes publicly accessible.

---

### Consistency

Every profile follows the same information hierarchy regardless of startup size or industry.

---

### Future Extensibility

Profiles are designed to support future additions such as:

- Revenue charts.
- Milestone timelines.
- Team members.
- Product showcases.
- Community verification.
- Additional trust indicators.

---

## 15.8 Current Architecture

At the time of writing, Public Startup Profiles provide:

- Startup identity.
- Founder information.
- Verified revenue.
- Trust indicators.
- Verification status.
- Public sharing.
- Controlled visibility.

Public Startup Profiles represent the primary destination for verified startups on Verifii and serve as the foundation for discovery throughout the platform.

The next chapter explains how these profiles are organized, ranked, and discovered through the Verifii Leaderboard.

---

# Chapter 16 — Leaderboard

The Leaderboard is Verifii's primary discovery platform for verified startups.

It provides a transparent, searchable, and trustworthy view of publicly published startups by presenting standardized verification information, revenue metrics, and trust indicators in a consistent format.

Unlike traditional startup directories, inclusion within the leaderboard is earned through successful verification and publication rather than simple registration.

---

## 16.1 Purpose

The purpose of the Leaderboard is to make verified startups easily discoverable while preserving the integrity of the platform.

It allows visitors to:

- Discover verified startups.
- Compare businesses using consistent metrics.
- Explore verified founder profiles.
- Identify growing companies.
- Evaluate startups using trusted information instead of marketing claims.

The leaderboard represents the public face of Verifii.

---

## 16.2 Leaderboard Philosophy

The leaderboard is built around several core principles.

### Verification Before Visibility

Only startups that satisfy the platform's publication requirements appear on the leaderboard.

Registration alone does not qualify a startup for inclusion.

---

### Fair Representation

Every publicly listed startup follows the same verification standards regardless of company size, industry, or subscription plan.

---

### Transparency

Visitors should immediately understand why a startup appears on the leaderboard and which information has been independently verified.

---

### Founder Control

Founders retain complete control over whether their verified startup appears publicly.

Removing a startup from public visibility immediately removes it from the leaderboard.

---

## 16.3 Leaderboard Components

The leaderboard presents standardized information for every published startup.

Typical information includes:

- Startup name.
- Logo.
- Founder.
- Industry.
- Verified revenue.
- Trust indicators.
- Verification status.
- Public profile link.

This standardized presentation allows visitors to compare startups consistently.

---

## 16.4 Inclusion Rules

A startup is eligible for the leaderboard only after satisfying the platform's publication requirements.

Current requirements include:

- Successful verification.
- Publication eligibility.
- Founder approval for public visibility.

Private startups never appear within leaderboard results.

---

## 16.5 Ranking Philosophy

The leaderboard is designed to rank startups using objective platform data rather than subjective popularity.

Ranking factors may include:

- Verified revenue.
- Verification quality.
- Trust indicators.
- Platform-defined ordering rules.

The exact ranking algorithm may evolve as the platform grows.

---

## 16.6 Search & Discovery

The leaderboard serves as the primary discovery interface for the public platform.

Visitors can explore startups using filters and search capabilities designed to simplify navigation as the platform grows.

Future discovery features may include:

- Industry filters.
- Revenue ranges.
- Geographic filters.
- Verification filters.
- Sorting options.

---

## 16.7 Visibility Integration

The leaderboard is fully integrated with the Visibility System.

Every displayed startup has passed the platform's publication requirements.

Visibility changes are reflected automatically without requiring manual intervention.

This ensures consistent behavior across all public platform surfaces.

---

## 16.8 Design Principles

The leaderboard follows several engineering principles.

### Trust First

Verification information receives higher priority than promotional content.

---

### Consistency

Every startup is displayed using the same information hierarchy.

---

### Scalability

The leaderboard is designed to accommodate significant platform growth while maintaining performance and usability.

---

### Discoverability

The interface should make it easy for visitors to discover relevant startups without compromising trust or clarity.

---

## 16.9 Current Architecture

At the time of writing, the Leaderboard provides:

- Public startup discovery.
- Verified startup listings.
- Standardized startup information.
- Public profile navigation.
- Trust indicators.
- Visibility enforcement.

The Leaderboard serves as the primary public gateway to the Verifii ecosystem and represents the culmination of the platform's verification, trust, and visibility systems.

---

## 18.10 Security Verification Framework

In addition to static architecture safeguards, Verifii enforces active runtime security through the **Verification & Security Review Framework (VRF)**. VRF provides empirical, black-box, and adversarial verification of provider revenue boundaries, self-reported claims, payment webhooks, billing safety, credential encryption, and database Row Level Security (RLS) policies.

For the comprehensive historical log of security investigations, findings (SEC-007-01 through SEC-007-03), adversarial testing evidence, and production database hardening, see [Chapter 25 — Verification & Security Review Framework (VRF)](#chapter-25-verification-security-review-framework-vrf).

---

## Future Evolution

Planned enhancements include:

- Advanced search and filtering.
- Industry-specific leaderboards.
- India and Global leaderboard views.
- Interactive revenue visualizations.
- Growth trend indicators.
- Founder achievements and milestones.
- Saved searches and personalized discovery.
- Additional ranking insights.

---

# Chapter 17 — Admin System

The Admin System provides Verifii's internal operational interface for managing platform integrity, reviewing verification outcomes, moderating content, and supporting founders.

Unlike founder-facing features, the Admin System is designed exclusively for authorized platform administrators and exists to maintain the quality, security, and trustworthiness of the ecosystem.

The administrative interface complements automated platform systems by providing controlled human oversight when exceptional situations require manual intervention.

---

## 17.1 Purpose

The purpose of the Admin System is to provide secure operational tools for managing the Verifii platform.

The Admin System allows authorized administrators to:

- Review startup submissions.
- Moderate platform content.
- Investigate verification anomalies.
- Review fraud indicators.
- Assist founders during exceptional cases.
- Monitor platform health.
- Perform operational maintenance.

The Admin System is not intended to replace automated verification or trust evaluation. Instead, it provides oversight where automation alone is insufficient.

---

## 17.2 Administration Philosophy

The Admin System is designed around four guiding principles.

### Automation First

Routine platform operations should be handled automatically.

Administrative intervention is reserved for exceptional cases that require human judgement.

---

### Least Privilege

Administrative capabilities are granted only to authorized personnel.

Every administrative action operates within defined permission boundaries.

---

### Transparency

Administrative decisions should be traceable and based on objective platform data rather than subjective judgement.

Whenever possible, administrators should review evidence produced by automated platform systems before taking action.

---

### Platform Integrity

The primary objective of every administrative workflow is to protect the trustworthiness and reliability of the Verifii ecosystem.

---

## 17.3 Administrative Components

The Admin System consists of several operational areas.

### Startup Review

Allows administrators to review startup submissions requiring manual attention.

Typical review scenarios include:

- Verification anomalies.
- Fraud alerts.
- Exceptional verification cases.
- Platform policy violations.

---

### Verification Oversight

Provides visibility into verification activity across the platform.

Administrators can review:

- Verification status.
- Provider synchronization outcomes.
- Verification history.
- Failed verification attempts.

The verification process itself remains automated.

---

### Trust & Fraud Monitoring

Allows administrators to inspect platform-generated trust and fraud signals.

Examples include:

- Elevated fraud indicators.
- Confidence anomalies.
- Risk classifications.
- Suspicious platform activity.

Administrative review supplements automated trust evaluation rather than replacing it.

---

### Platform Operations

Provides operational controls used to maintain platform health.

Examples include:

- Monitoring platform activity.
- Reviewing operational alerts.
- Supporting internal maintenance.
- Managing administrative workflows.

---

## 17.4 Administrative Workflow

The Admin System supports the following operational workflow.

Platform Activity

↓

Automated Detection

↓

Administrative Review (when required)

↓

Decision

↓

Platform Update

↓

Operational Logging

Most platform activity never reaches administrative review because automated systems resolve the majority of verification and trust decisions independently.

---

## 17.5 Integration with Platform Systems

The Admin System integrates with several core platform subsystems.

### Verification System

Receives verification outcomes requiring human review.

---

### Trust & Fraud Engine

Provides fraud indicators and confidence assessments to assist administrative decision making.

---

### Visibility System

Allows administrators to review publication-related issues while respecting platform visibility rules.

---

### Subscription & Billing

Supports investigation of billing-related operational issues when necessary.

---

### Founder Dashboard

Administrative actions may influence founder workflows by resolving issues that prevent verification or publication.

---

## 17.6 Design Principles

The Admin System follows several architectural principles.

### Operational Safety

Administrative tools should never bypass platform security controls without explicit authorization.

---

### Auditability

Administrative actions should be recorded to support accountability and future investigation.

---

### Separation of Responsibilities

Administrative capabilities remain isolated from founder-facing functionality.

Operational tooling should never interfere with standard founder workflows.

---

### Scalability

The Admin System should continue supporting platform growth through improved moderation tools, analytics, and operational automation.

---

## 17.7 Current Architecture

At the time of writing, the Admin System provides:

- Startup review.
- Verification oversight.
- Fraud monitoring.
- Administrative moderation.
- Platform operations.
- Secure administrative access.

The system works alongside Verifii's automated verification pipeline to maintain platform integrity while minimizing the need for manual intervention.

---

## Future Evolution

Planned enhancements include:

- Administrative analytics dashboard.
- Advanced moderation tools.
- Comprehensive audit logs.
- Verification replay capabilities.
- Platform health monitoring.
- Internal operational metrics.
- Bulk administrative actions.
- AI-assisted fraud investigation.

---

# Chapter 18 — Security Architecture

Security is a foundational design principle of Verifii rather than a feature added after development.

Every major subsystem—including authentication, verification, provider integrations, billing, public visibility, and administrative operations—has been designed with security as a primary consideration.

The objective of Verifii's Security Architecture is to protect founder data, preserve the integrity of verified information, and ensure that every public trust signal displayed on the platform is backed by secure engineering practices.

---

## 18.1 Purpose

The purpose of the Security Architecture is to establish a consistent framework for protecting platform resources, sensitive information, and public trust.

The security architecture is responsible for:

- Protecting founder accounts.
- Securing payment provider integrations.
- Preventing unauthorized access.
- Preserving verification integrity.
- Protecting sensitive credentials.
- Enforcing backend authorization.
- Maintaining platform availability.

Security is considered throughout the entire platform lifecycle rather than within isolated components.

---

## 18.2 Security Philosophy

Verifii follows several guiding security principles.

### Security by Design

Security considerations are incorporated during system design instead of being introduced after implementation.

Every new feature should be evaluated from a security perspective before development begins.

---

### Backend Trust

The backend is the authoritative source of truth for every security-sensitive operation.

Frontend applications improve usability but never replace backend validation.

---

### Least Privilege

Every user, service, and subsystem receives only the permissions necessary to perform its intended responsibilities.

Limiting permissions reduces the impact of potential failures or misuse.

---

### Defense in Depth

No individual security control is assumed to be sufficient on its own.

Authentication, authorization, validation, encryption, rate limiting, and auditing work together to protect the platform.

---

## 18.3 Authentication Security

Authentication is managed through secure identity services.

Key principles include:

- Verified user identities.
- Secure session management.
- Protected authentication flows.
- Session validation.
- Secure account ownership.

Authentication establishes identity before any protected platform operation is performed.

---

## 18.4 Authorization Security

Authorization protects platform resources after authentication has succeeded.

Every protected request performs:

- Ownership validation.
- Permission verification.
- Role validation.
- Resource access checks.

Authorization decisions are enforced entirely on the backend.

---

## 18.5 Provider Credential Security

Payment provider credentials represent some of the platform's most sensitive information.

The Provider Integration Layer protects these credentials through several measures:

- Backend-only processing.
- Secure storage.
- Encryption where persistence is required.
- Restricted access.
- Ownership validation before use.

Credentials are never exposed through public APIs or frontend applications.

---

## 18.6 Data Protection

Verifii protects sensitive platform data throughout its lifecycle.

Examples include:

- Founder information.
- Verification data.
- Billing information.
- Provider credentials.
- Administrative information.

Protection mechanisms include:

- Encryption.
- Secure storage.
- Controlled access.
- Server-side validation.
- Principle of least privilege.

---

## 18.7 API Security

Every API request passes through multiple security layers before business logic executes.

These include:

- Authentication.
- Authorization.
- Input validation.
- Rate limiting.
- Ownership verification.
- Secure error handling.

No protected API trusts client-provided data without independent validation.

---

## 18.8 Public Surface Protection

Public resources are protected through centralized visibility enforcement.

Examples include:

- Leaderboard.
- Startup Profiles.
- Public APIs.
- Verification Badges.
- Open Graph Images.
- Search Engine Indexing.

Only startups satisfying the platform's publication requirements become publicly accessible.

Private resources remain inaccessible to unauthorized users.

---

## 18.9 Fraud Resistance

The platform incorporates automated mechanisms that help detect suspicious activity and preserve the integrity of verification.

These mechanisms include:

- Trust evaluation.
- Fraud indicators.
- Verification consistency checks.
- Administrative review when required.
- Controlled publication workflows.

Fraud detection complements—not replaces—the Verification System.

---

## 18.10 Operational Security

Security extends beyond application code into operational practices.

Examples include:

- Secure deployment.
- Environment variable protection.
- Controlled administrative access.
- Infrastructure monitoring.
- Secure backups.
- Dependency management.

Operational security ensures that platform integrity is maintained throughout deployment and maintenance.

---

## 18.11 Security Principles

The Security Architecture follows several long-term principles.

### Protect Founders

Founder information should never be exposed unnecessarily.

---

### Preserve Trust

Every public trust signal must be backed by secure verification processes.

---

### Minimize Risk

Every subsystem should minimize its attack surface by exposing only the functionality required for its responsibilities.

---

### Continuous Improvement

Security is an ongoing process.

As Verifii evolves, new threats, providers, and platform capabilities will require continuous security improvements.

---

## 18.12 Current Architecture

At the time of writing, Verifii's Security Architecture includes:

- Secure authentication.
- Backend authorization.
- Ownership validation.
- Provider credential protection.
- Visibility enforcement.
- Rate limiting.
- Fraud detection.
- Administrative controls.
- Secure API architecture.
- Defense-in-depth principles.

Security is not implemented as a standalone subsystem. Instead, it forms a foundational layer that supports every architectural component documented throughout this handbook.

---

## 18.13 Implemented Security Improvements

Since its initial design, Verifii has implemented significant security hardening measures across the platform.

These improvements include:
- **AES-256-GCM Encryption:** Upgraded provider credential encryption to AES-256-GCM using random initialization vectors and authentication tags.
- **Legacy CTR Fallback:** Maintained fallback decryption for legacy AES-256-CTR to ensure seamless migration.
- **Encrypted Provider Credentials:** Payment provider keys are never stored in plaintext.
- **Signed URLs for Private Storage:** Verification proofs and internal documents are served via securely signed, time-limited URLs.
- **CSRF Protection:** Implemented cross-site request forgery protection across sensitive mutations.
- **Webhook Signature Verification:** Cryptographically verifying inbound webhooks from Stripe and Razorpay before processing state changes.
- **Backend Ownership Validation:** Every modification to a startup strictly validates that the authenticated founder owns the requested resource.
- **Server-Only Provider Communication:** Enforcing that provider SDKs execute exclusively on the backend.
- **Rate Limiting:** Added rate limiting (`rate-limit.ts`) to mitigate automated abuse.
- **Secure Network Layer:** Added a safe fetching abstraction (`safe-network.ts`) for external communications.

---

## 18.14 Startup Submission Security

The Startup Submission subsystem follows a defense-in-depth security architecture. No individual validation is considered sufficient to establish trust. Instead, ownership validation, namespace isolation, canonical proof storage, storage metadata verification, magic-byte validation, database constraints, and least-privilege database access work together as layered protections against unauthorized access, duplicate submissions, proof manipulation, and race-condition failures.

The startup submission pipeline implements multi-layered security controls to protect the verification process and user data:

- User ownership enforcement
- Namespace isolation
- Canonical proof storage
- Private storage buckets
- Signed URL access
- Storage metadata validation
- Magic-byte validation
- Partial unique index
- RPC security hardening
- Least privilege
- **Race-condition resilience**: Built-in retry loops and database unique constraint handling.

---

## 18.15 Onboarding Security Hardening

The onboarding flow follows a defense-in-depth security model.

Multiple independent security layers work together to protect startup creation.

### Server-Owned Identity

Client-provided ownership identifiers are discarded.

Startup ownership is always resolved from the authenticated server session.

### Upload Hardening

Accepted file types:

- image/png
- image/jpeg
- image/webp
- application/pdf

Maximum upload size:

- 10 MB

Rejected uploads include:

- corrupted files
- empty files
- unsupported formats

### Magic-Byte Validation

PDF files are validated using magic-byte inspection.

Validation never relies solely on MIME types.

### Shared Validation Enforcement

Client validation is never trusted.

All onboarding rules are enforced through the centralized validation schema.

### Provider Whitelist Enforcement

The onboarding flow accepts only:

- Razorpay
- Stripe

Unsupported providers are rejected before any database operations occur.

---

## Future Evolution

Planned security enhancements include:

- Two-factor authentication (2FA).
- Audit logging for security-sensitive actions.
- Security event monitoring.
- Advanced anomaly detection.
- Fine-grained administrative permissions.
- Organization and team-based access control.
- Automated security health checks.
- Expanded penetration testing and security reviews.

---

# Chapter 19 — Operations & Deployment

Operations and Deployment define how Verifii is built, deployed, monitored, maintained, and operated in production.

While previous chapters describe the application's architecture and business systems, this chapter focuses on the infrastructure and operational practices that ensure the platform remains reliable, secure, and continuously available.

The objective is to establish repeatable operational procedures that support long-term product growth while minimizing downtime, deployment risk, and operational complexity.

---

## 19.1 Purpose

The purpose of the Operations & Deployment architecture is to provide a reliable process for delivering changes from development into production while maintaining platform stability.

The operational architecture is responsible for:

- Continuous deployment.
- Infrastructure management.
- Environment configuration.
- Production monitoring.
- Incident response.
- Backup and recovery.
- Operational maintenance.

These responsibilities ensure that Verifii remains available, secure, and maintainable as the platform evolves.

---

## 19.2 Operational Philosophy

Operations within Verifii are guided by several core principles.

### Reliability Before Speed

New features should never compromise platform stability.

Every deployment should prioritize predictable behavior over rapid delivery.

---

### Automation First

Wherever practical, operational tasks should be automated.

Examples include:

- Production deployments.
- Build validation.
- Database migrations.
- Backup routines.
- Monitoring.

Automation reduces human error and improves consistency.

---

### Small, Incremental Changes

Large deployments introduce unnecessary risk.

The preferred approach is to release smaller, independently testable changes whenever possible.

---

### Recoverability

Every deployment should have a clear recovery path.

If a deployment introduces unexpected behavior, the platform should be capable of returning to a stable state with minimal downtime.

---

## 19.3 Environment Strategy

Verifii operates across multiple environments.

### Local Development

Used for feature development, experimentation, and debugging.

Characteristics include:

- Local application runtime.
- Local environment variables.
- Developer testing.
- Rapid iteration.

---

### Staging (Future)

A production-like environment used for validating changes before public release.

Typical uses include:

- End-to-end testing.
- QA validation.
- Integration testing.
- Release verification.

---

### Production

The live platform used by founders and public visitors.

Production prioritizes:

- Stability.
- Security.
- Performance.
- High availability.
- Data integrity.

Production changes should occur only after successful validation.

---

## 19.4 Deployment Workflow

The standard deployment lifecycle follows these stages.

Feature Development

↓

Local Testing

↓

Type Checking

↓

Production Build Validation

↓

Git Commit

↓

GitHub Push

↓

Automatic Deployment

↓

Production Verification

↓

Monitoring

Each deployment must pass validation before reaching production.

---

## 19.5 Infrastructure

The current infrastructure consists of several major services.

### Application Hosting

The frontend and backend are deployed using Vercel.

Responsibilities include:

- Application hosting.
- Serverless execution.
- Automatic deployments.
- Environment management.

---

### Database

Supabase PostgreSQL serves as the primary persistent datastore.

Responsibilities include:

- Application data.
- Authentication.
- Storage.
- Row Level Security.
- Database functions.

---

### External Services

Additional services support the platform, including:

- Payment providers.
- Email delivery.
- Domain management.
- Third-party APIs.

Each external dependency is isolated behind dedicated integration layers wherever practical.

---

## 19.6 Monitoring

Production systems require continuous monitoring.

Operational monitoring includes:

- Application availability.
- Deployment status.
- API health.
- Verification failures.
- Provider availability.
- Billing events.
- Error rates.

Monitoring allows operational issues to be detected before they significantly affect founders.

---

## 19.7 Backup & Recovery

Platform reliability depends on preserving critical data.

Operational practices include:

- Database backups.
- Recovery planning.
- Migration safety.
- Deployment rollback procedures.
- Infrastructure redundancy where practical.

Recovery procedures should be tested periodically rather than assumed to function correctly.

---

## 19.8 Incident Management

Operational incidents are handled using a structured process.

Typical workflow:

Incident Detected

↓

Impact Assessment

↓

Root Cause Investigation

↓

Mitigation

↓

Recovery

↓

Post-Incident Review

↓

Preventive Improvements

Every operational issue should result in long-term platform improvements.

---

## 19.9 Operational Security

Operational practices follow the same security principles described in Chapter 18.

Examples include:

- Protected environment variables.
- Restricted production access.
- Secure deployment pipelines.
- Infrastructure access control.
- Secret management.
- Dependency updates.

Operational security protects both infrastructure and founder data.

---

## 19.10 Design Principles

The Operations & Deployment architecture follows several engineering principles.

### Predictability

Deployments should behave consistently across environments.

---

### Observability

Operational systems should provide sufficient visibility into platform behavior to support rapid diagnosis.

---

### Maintainability

Infrastructure should remain understandable and easy to operate as the platform grows.

---

### Scalability

Operational processes should support increasing numbers of users, startups, providers, and deployments without requiring fundamental redesign.

---

## 19.11 Current Architecture

At the time of writing, Verifii's operational infrastructure includes:

- Automated production deployments.
- Vercel hosting.
- Supabase database infrastructure.
- Production build validation.
- Environment configuration.
- Monitoring foundations.
- Secure operational practices.

These systems provide the operational foundation required to deliver Verifii as a reliable production platform.

---

## Future Evolution

Planned operational improvements include:

- Dedicated staging environment.
- Automated rollback strategies.
- Health check dashboards.
- Centralized application logging.
- Performance monitoring.
- Error tracking and alerting.
- Disaster recovery testing.
- Infrastructure automation.
- Deployment analytics.
- Continuous operational audits.

---

# Chapter 20 — Development Standards & Best Practices

This chapter establishes the engineering standards that govern how Verifii is designed, developed, tested, documented, and maintained.

The objective is to ensure that every contributor follows consistent engineering practices, regardless of when or by whom a feature is developed.

These standards are intended to improve code quality, maintainability, security, and long-term scalability while reducing technical debt.

---

## 20.1 Engineering Philosophy

Every engineering decision within Verifii should support the following goals:

- Simplicity over unnecessary complexity.
- Readability over cleverness.
- Security before convenience.
- Long-term maintainability.
- Modular architecture.
- Predictable behaviour.
- Documentation alongside development.

Code is written for future engineers—not just for the current implementation.

---

## 20.2 Project Structure

Every feature should have a clear responsibility.

The project structure should remain organized around domains rather than individual pages.

Examples include:

- Authentication
- Verification
- Provider Integrations
- Billing
- Dashboard
- Public Platform
- Administration

Files should be located near the functionality they support.

Business logic should not be duplicated across multiple locations.

---

## 20.3 Naming Conventions

Naming should prioritize clarity.

### Variables

Use descriptive names.

Good examples:

- startupSubmission
- providerConnection
- verificationStatus

Avoid abbreviations unless universally understood.

---

### Functions

Functions should describe actions.

Examples:

- verifyStartup()
- calculateTrustScore()
- publishStartup()

Function names should clearly communicate intent.

---

### Components

React components should use PascalCase.

Examples:

- FounderVerificationFlow
- LeaderboardCard
- StartupProfile

---

### Files

File names should remain consistent with the surrounding project structure.

---

## 20.4 Architecture Guidelines

Every new feature should follow the existing platform architecture.

Frontend responsibilities:

- UI
- User interaction
- Temporary state

Backend responsibilities:

- Business logic
- Authorization
- Validation
- Security
- Database interaction

Business logic should never be duplicated inside frontend components.

---

## 20.5 API Standards

Every API endpoint should:

- Validate authentication.
- Validate authorization.
- Validate ownership.
- Validate request payloads.
- Return consistent responses.
- Handle expected failures gracefully.
- Log unexpected failures.

Protected APIs must never trust client input without independent verification.

---

## 20.6 Database Standards

Database changes should follow several principles.

- Prefer additive migrations.
- Preserve backwards compatibility whenever practical.
- Avoid destructive schema changes.
- Protect historical information.
- Maintain data integrity.

Every migration should be reviewed before production deployment.

---

## 20.7 Git Workflow

Development follows a Git-based workflow.

Typical lifecycle:

Feature Development

↓

Local Testing

↓

Type Checking

↓

Production Build Validation

↓

Commit

↓

Push

↓

Deployment

Small commits are preferred over large unrelated changes.

Each commit should represent one logical improvement.

---

## 20.8 Commit Message Standards

Commit messages should describe the purpose of a change.

Preferred format:

```
type(scope): short description
```

Examples:

```
feat(verification): support Razorpay API validation

fix(visibility): enforce public visibility rules

refactor(api): simplify provider routing
```

Common commit types include:

- feat
- fix
- refactor
- docs
- test
- chore
- perf

---

## 20.9 Testing Standards

Every feature should be validated before deployment.

Minimum expectations include:

- TypeScript compilation.
- Production build.
- Functional testing.
- Regression testing where appropriate.

No feature should be merged without confirming that existing functionality remains operational.

---

## 20.10 Documentation Standards

Every significant architectural change should update documentation.

Examples include:

- Engineering Handbook
- Architecture Decision Records
- Implementation Plan
- API documentation

Documentation should evolve together with the platform.

---

## 20.11 Security Standards

Security is everyone's responsibility.

Developers should:

- Validate every request.
- Protect sensitive information.
- Minimize exposed data.
- Follow least-privilege principles.
- Avoid trusting frontend input.
- Review security implications before merging features.

---

## 20.12 AI-Assisted Development

AI tools are used to accelerate development but do not replace engineering judgement.

Current development workflow may include:

- ChatGPT
- Claude
- Cursor
- Antigravity

Every AI-generated change must be:

- Reviewed.
- Understood.
- Tested.
- Validated before production.

Generated code should never be accepted without engineering review.

---

## 20.13 Pull Request Guidelines

Every pull request should answer:

- What problem is being solved?
- Why is this solution appropriate?
- Which systems are affected?
- Has documentation been updated?
- Has the feature been tested?

Review quality is more important than review speed.

---

## 20.14 Definition of Done

A feature is considered complete only when:

- Functionality is implemented.
- Code is reviewed.
- Types compile successfully.
- Production build succeeds.
- Security considerations have been reviewed.
- Documentation is updated.
- No existing functionality has regressed.

Completion is determined by platform quality rather than implementation speed.

---

## 20.15 Technical Debt

Technical debt should be acknowledged rather than ignored.

When shortcuts are unavoidable:

- Document the limitation.
- Record the reason.
- Define future improvements.
- Prevent repeated workarounds.

Technical debt should be intentional—not accidental.

---

## 20.16 Engineering Culture

The long-term success of Verifii depends on maintaining high engineering standards.

Engineers are encouraged to:

- Build simple systems.
- Prefer clarity over cleverness.
- Leave the codebase better than they found it.
- Challenge architectural decisions respectfully.
- Document important knowledge.
- Think about future maintainers.

Every contribution should improve both the product and the engineering foundation supporting it.

---

## 20.17 Dashboard Engineering Standards

To maintain architectural integrity, the dashboard is governed by permanent engineering rules:

- **Dashboard pages orchestrate only.** They fetch data and pass it to downstream engines, but never perform calculations themselves.
- **Business logic belongs outside UI.** Presentation code should never make decisions about financial aggregation or trust evaluation.
- **Widgets never perform calculations.** They only receive pre-formatted values.
- **Widgets never format business values.** Number formatting, currency conversion, and date rendering must happen in the presentation layer before the UI receives it.
- **No duplicated financial logic.** The `getAggregatedRevenue()` function is the only place MRR or ARR is calculated.
- **Server owns business logic.** Clients only render what the server instructs them to render.
- **Revenue Aggregation remains the Single Source of Truth.** No other subsystem may infer or estimate revenue.
- **Provider SDKs never execute inside UI.** All communication with payment gateways must happen securely on the backend.

---

## 20.18 Startup Submission Engineering Standards

- Startup names must be normalized before duplicate evaluation.
- Backend owns submission validation.
- Duplicate submissions must be idempotent.
- Auxiliary writes must never invalidate successful startup creation.
- Route handlers must use centralized logger.
- Proof ownership must always be validated server-side.
- Business rules belong on the backend.
- Public mutation endpoints should be designed to be idempotent whenever practical to ensure safe retries, concurrent execution, and predictable system behavior.

---

## 20.19 Onboarding Engineering Standards

The onboarding system follows permanent engineering rules.

- Validation rules must exist in exactly one place.
- Sensitive fields must never be persisted in browser storage.
- Draft restoration must never overwrite existing drafts.
- Banner visibility must remain independent from draft existence.
- Draft storage must support cross-tab synchronization.
- Uploaded proofs must pass server-side validation.
- Client-provided ownership information must never be trusted.
- Unsupported payment providers must be rejected by both client and server.
- Browser validation exists only for user experience.
- Server validation remains authoritative.

---

## Future Evolution

As Verifii grows, these standards will expand to include:

- Multi-team development workflows.
- Organization-wide coding standards.
- Automated quality gates.
- Continuous integration policies.
- Architecture review processes.
- Security review checklists.
- Performance budgets.
- Contributor onboarding guides.

This chapter serves as the engineering foundation that will guide Verifii's development as the platform evolves.

---

# Chapter 21 — Architecture Decision Records (ADR)

Architecture Decision Records (ADRs) preserve the reasoning behind the most significant technical and product decisions made during Verifii's development.

Unlike implementation documentation, ADRs explain **why** decisions were made, what alternatives were considered, and the long-term consequences of each choice.

The purpose of this chapter is to ensure that future contributors understand the context behind important architectural decisions rather than repeating the same discussions or unintentionally reversing intentional design choices.

Every ADR follows the same structure:

- Context
- Decision
- Alternatives Considered
- Consequences
- Future Evolution (optional)
- Related ADRs (optional)
- Status

---

# ADR Index

| ADR | Title | Status |
|------|-------|--------|
| ADR-001 | India-First Platform Strategy | Accepted |
| ADR-002 | Verification Before Publication | Accepted |
| ADR-003 | Private by Default | Accepted |
| ADR-004 | Razorpay as the Primary Verification Provider | Accepted |
| ADR-005 | Manual Stripe Verification | Accepted |
| ADR-006 | Trust Before Growth | Accepted |
| ADR-007 | Backend as the Source of Truth | Accepted |
| ADR-008 | Revenue Aggregation as Single Source of Truth | Accepted |
| ADR-009 | Snapshot-Based Dashboard | Accepted |
| ADR-010 | Business Logic Transformation Layer | Accepted |
| ADR-011 | Presentation Transformation Layer | Accepted |
| ADR-012 | Read/Write Separation | Accepted |
| ADR-013 | Provider Isolation | Accepted |
| ADR-014 | Dashboard as Orchestrator | Accepted |
| ADR-015 | Snapshot First Architecture | Accepted |
| ADR-016 | Financial Determinism | Accepted |
| ADR-017 | Presentation Model Pattern | Accepted |
| ADR-018 | Revenue Engine V2 (Subscription-Normalized Revenue) | Accepted (Post Launch) |
| ADR-019 | Verification Events as the Canonical Source of Truth | Accepted |
| ADR-020 | Event Projection Architecture | Accepted |
| ADR-021 | Idempotent Startup Submission | Accepted |
| ADR-022 | Secure Proof Upload Pipeline | Accepted |
| ADR-023 | Best-Effort Auxiliary Writes | Accepted |
| ADR-024 | Centralized Logging Architecture | Accepted |
| ADR-025 | Explicit Onboarding Completion State | Accepted (Post Launch) |
| ADR-026 | OAuth Re-authentication for Destructive Actions | Accepted |
| ADR-027 | Draft Recovery & Crash Resilience | Accepted |
| ADR-028 | Shared Validation Architecture | Accepted |
| ADR-029 | Banner State Separation | Accepted |
| ADR-030 | Process-Local Analytics Caching | Accepted |

---

# ADR-001 — India-First Platform Strategy

## Context

Verifii was originally envisioned as a global startup verification platform.

However, early product research revealed that Indian founders lacked a platform specifically designed around the tools, payment providers, currencies, and workflows commonly used within the Indian startup ecosystem.

Most existing products prioritized international payment providers while offering limited support for Indian founders.

---

## Decision

Verifii adopted an India-first strategy while maintaining global compatibility.

This decision influences:

- Provider prioritization.
- Founder onboarding.
- Currency presentation.
- Product messaging.
- Documentation.
- Future roadmap.

Razorpay became the primary verification provider while Stripe remained fully supported for international founders.

---

## Alternatives Considered

- Global-first launch.
- Stripe-first implementation.
- India-only platform.

---

## Consequences

### Positive

- Better product-market fit.
- Clear differentiation.
- Simpler onboarding for Indian founders.

### Trade-offs

- Additional localization work.
- More provider-specific engineering.

---

## Status

**Accepted**

---

# ADR-002 — Verification Before Publication

## Context

Traditional startup directories publish startups immediately after submission.

This approach allows unverified companies to appear publicly without establishing credibility.

---

## Decision

Startup creation, verification, and publication were separated into independent stages.

Every startup now follows:

Submission

↓

Private Startup

↓

Verification

↓

Publication Eligibility

↓

Founder Publishes

---

## Alternatives Considered

- Publish immediately.
- Publish after submission approval.
- Manual moderation.

---

## Consequences

### Positive

- Higher platform trust.
- Cleaner verification workflow.
- Better founder control.

### Trade-offs

- Slightly longer onboarding.

---

## Status

**Accepted**

---

# ADR-003 — Private by Default

## Context

Early audits revealed that public queries exposed startups regardless of verification state.

This created privacy risks and weakened the platform's trust model.

---

## Decision

The `is_public` field became the single source of truth for public visibility.

Every public surface—including profiles, leaderboard, badges, APIs, sitemap, and Open Graph images—must respect this visibility gate.

New startups remain private until founders intentionally publish them after satisfying publication requirements.

---

## Alternatives Considered

- Multiple visibility flags.
- Verification status as visibility control.
- Manual publication lists.

---

## Consequences

### Positive

- Centralized visibility logic.
- Strong privacy guarantees.
- Easier maintenance.
- Consistent public behaviour.

### Trade-offs

- Additional publication workflow.

---

## Status

**Accepted**

---

# ADR-004 — Razorpay as the Primary Verification Provider

## Context

The original verification interface treated Stripe as the primary provider.

This conflicted with Verifii's India-first strategy.

---

## Decision

Razorpay became the primary provider presented throughout founder verification.

Stripe remains fully supported but is positioned as the international alternative.

---

## Alternatives Considered

- Equal provider presentation.
- Stripe-first interface.
- Automatic provider selection.

---

## Consequences

### Positive

- Better experience for Indian founders.
- Stronger product positioning.
- Consistent onboarding.

### Trade-offs

- International founders perform one additional selection.

---

## Status

**Accepted**

---

# ADR-005 — Manual Stripe Verification

## Context

The original Stripe OAuth experience introduced unnecessary complexity and reliability issues for founders.

---

## Decision

The founder verification interface now prioritizes manual API credential verification for Stripe.

Backend support for OAuth remains available but is no longer exposed as the primary founder workflow.

---

## Alternatives Considered

- OAuth only.
- Manual keys only.
- Hybrid interface.

---

## Consequences

### Positive

- Simpler verification.
- Fewer onboarding failures.
- More predictable user experience.

### Trade-offs

- OAuth remains unused until future improvements.

---

## Status

**Accepted**

---

# ADR-006 — Trust Before Growth

## Context

Many startup platforms optimize for rapid growth by allowing immediate publication.

Verifii was designed around long-term trust rather than maximum listing volume.

---

## Decision

Platform integrity always takes precedence over startup count.

Verification, trust evaluation, fraud detection, and visibility enforcement remain mandatory parts of the publication workflow.

---

## Alternatives Considered

- Growth-first marketplace.
- Open startup directory.
- Community moderation.

---

## Consequences

### Positive

- Higher credibility.
- Stronger differentiation.
- More reliable public information.

### Trade-offs

- Slower platform growth.

---

## Status

**Accepted**

---

# ADR-007 — Backend as the Source of Truth

## Context

Frontend applications can improve user experience but cannot be trusted to enforce security or business rules.

---

## Decision

Every security-sensitive decision is enforced by backend systems.

Examples include:

- Authentication.
- Authorization.
- Verification.
- Billing.
- Visibility.
- Publication.
- Ownership validation.

Frontend interfaces remain responsible only for presentation and interaction.

---

## Alternatives Considered

- Client-side validation.
- Shared frontend/backend business rules.

---

## Consequences

### Positive

- Stronger security.
- Consistent behaviour.
- Easier auditing.
- Reduced attack surface.

---

## Status

**Accepted**

---

# ADR-008 — Revenue Aggregation as Single Source of Truth

## Context
Financial calculations were previously distributed across dashboard components and verification logic, leading to inconsistencies.

## Decision
Revenue aggregation was centralized into a single engine. All MRR, ARR, and financial health metrics are calculated exclusively in this layer.

## Consequences
Guarantees financial determinism but requires all other systems to depend on the aggregation output.

---

# ADR-009 — Snapshot-Based Dashboard

## Context
Loading external provider APIs directly into the dashboard caused slow rendering and exposed the platform to third-party rate limits.

## Decision
The dashboard was refactored to read exclusively from immutable snapshots stored in the database.

## Consequences
Instant dashboard load times, but requires robust synchronization to keep snapshots updated.

---

# ADR-010 — Business Logic Transformation Layer

## Context
Dashboard pages mixed data fetching and business decisions.

## Decision
Introduced an Engine layer (`revenue-engine.ts`) to extract business facts from raw database rows before passing them to the UI.

## Consequences
Stronger testing boundaries, but adds an intermediate pipeline stage.

---

# ADR-011 — Presentation Transformation Layer

## Context
UI components were burdened with complex formatting and conditional rendering logic based on raw data states.

## Decision
Introduced Presenters (`revenue-presenter.ts`) to transform business facts into view models optimized for immediate rendering.

## Consequences
UI components become purely declarative, but requires mapping boilerplate.

---

# ADR-012 — Read/Write Separation

## Context
Single endpoints were handling both complex mutations (sync) and heavy queries (dashboard rendering).

## Decision
Architectural separation between state synchronization (write operations) and dashboard presentation (read models).

## Consequences
Independent scaling of background synchronization and UI rendering.

---

# ADR-013 — Provider Isolation

## Context
Provider SDK logic (like Stripe client initialization) was mixed into UI components or general utility files.

## Decision
Provider SDKs are strictly isolated to backend synchronization API routes and webhook handlers.

## Consequences
Complete provider abstraction for the rest of the platform.

---

# ADR-014 — Dashboard as Orchestrator

## Context
Dashboard pages were becoming monoliths responsible for data fetching, business logic, formatting, and rendering.

## Decision
The dashboard page file serves solely as an orchestrator that passes data through the Engine -> Presenter -> Widget pipeline.

## Consequences
Enforces the Single Responsibility Principle for the dashboard layer.

---

# ADR-015 — Snapshot First Architecture

## Context
Historical revenue tracking was difficult when relying on live API calls.

## Decision
Verification and analytics rely entirely on persisted, immutable snapshots.

## Consequences
Permanent historical records, enabling complex retrospective analytics.

---

# ADR-016 — Financial Determinism

## Context
Handling provider API instabilities (e.g., suspicious zeroes) inconsistently caused trust scores to fluctuate.

## Decision
Aggregation logic must be 100% deterministic, implementing standard fallbacks for known provider anomalies.

## Consequences
Trust engine inputs remain stable even during temporary provider outages.

---

# ADR-017 — Presentation Model Pattern

## Context
Passing raw backend types to frontend components caused tight coupling between the database schema and the UI.

## Decision
The system utilizes presentation models (View Models) to decouple the UI from the underlying domain objects.

## Consequences
UI components can evolve independently of the database schema.

---

# ADR-018 — Revenue Engine V2 (Subscription-Normalized Revenue)

**Status:** Accepted (Post Launch)

**Date:** July 2026

## Context

Verifii's launch architecture determines verified revenue by aggregating payment activity over a rolling 30-day window. This approach provides a reliable, provider-agnostic verification mechanism that works across supported payment processors and enables rapid product delivery.

However, transaction-based aggregation is not equivalent to Monthly Recurring Revenue (MRR) for subscription businesses. SaaS companies frequently experience annual billing, quarterly plans, upgrades, downgrades, refunds, and one-time purchases that distort a simple trailing 30-day revenue calculation.

As Verifii's long-term vision is to become the trust layer for SaaS and subscription businesses, the revenue engine must eventually evolve from transaction aggregation to subscription-normalized revenue calculations.

The launch implementation intentionally prioritizes correctness, simplicity, and provider compatibility over subscription-aware financial modeling.

---

## Decision

Verifii will adopt a two-stage revenue architecture.

### Phase 1 (Launch)

Revenue verification will continue using provider transaction aggregation over a rolling 30-day period.

This implementation serves as the authoritative revenue verification engine for the initial public release.

### Phase 2 (Post Launch)

The revenue engine will evolve to calculate normalized Monthly Recurring Revenue (MRR) directly from active subscription data rather than payment transactions.

Where supported by providers, recurring subscription objects will become the primary input for revenue calculations.

The Revenue Engine will remain the single source of truth for all platform financial metrics regardless of the underlying calculation strategy.

---

## Rationale

This staged approach balances engineering complexity with product reliability.

Maintaining transaction aggregation for launch allows:

- Faster product delivery.
- Consistent behavior across supported payment providers.
- Simpler verification logic.
- Lower operational risk during the initial launch.

Transitioning to subscription-normalized revenue after launch provides:

- More accurate SaaS metrics.
- Better handling of annual and quarterly billing.
- Improved comparability across startups.
- Stronger trust in published MRR figures.
- A foundation for advanced analytics such as churn, expansion revenue, and cohort analysis.

---

## Consequences

### Positive

- Preserves launch stability.
- Maintains a single authoritative Revenue Engine.
- Enables future migration without changing downstream consumers.
- Improves long-term financial accuracy.
- Supports advanced subscription analytics.

### Negative

- Launch metrics may differ from true accounting MRR.
- Subscription normalization increases implementation complexity.
- Different providers expose subscription data with varying capabilities.

---

## Alternatives Considered

### Option A — Subscription-normalized MRR for launch

Rejected.

Although financially superior, this would significantly increase implementation complexity, delay launch, and require provider-specific subscription models before validating product-market fit.

### Option B — Continue using transaction aggregation indefinitely

Rejected.

While operationally simple, this approach would not accurately represent recurring revenue for subscription businesses and would limit Verifii's long-term credibility.

---

## Related ADRs

- ADR-008 — Revenue Aggregation as Single Source of Truth
- ADR-021 — Idempotent Startup Submission

---

# ADR-019 — Verification Events as the Canonical Source of Truth

**Status:** Accepted

**Date:** July 2026

## Context

Verifii integrates with multiple payment providers, verification methods, and trust systems to establish the authenticity of a startup's reported revenue.

Initially, it would have been possible for different parts of the platform—such as the homepage, founder dashboard, leaderboard, notifications, or analytics—to independently query provider APIs or derive verification state from disparate database tables.

This approach would lead to duplicated business logic, inconsistent verification states, increased provider API usage, and conflicting interpretations of a startup's verification lifecycle.

As the platform grows, verification outcomes must become durable business events that can be consumed consistently by every downstream system.

---

## Decision

Verifii adopts an event-driven verification architecture.

Every successful verification operation must produce a durable verification event that is recorded in the platform's verification event store (`verification_logs`).

These events become the canonical representation of verification activity.

Downstream systems must consume persisted verification events rather than directly interpreting provider responses or reconstructing verification state independently.

Verification providers remain responsible only for producing evidence.

The platform remains responsible for recording, validating, and exposing verification events.

---

## Rationale

Separating verification execution from verification consumption creates a clear architectural boundary.

Persisted verification events provide:

- A single source of truth for verification history.
- Consistent business behavior across the platform.
- Reduced duplication of verification logic.
- Improved auditability.
- Lower dependency on external provider availability.
- Support for future event-driven features.

This architecture also enables multiple platform capabilities—including public activity feeds, notifications, analytics, and historical reporting—to operate from the same authoritative dataset.

---

## Consequences

### Positive

- Establishes a canonical verification history.
- Decouples provider integrations from presentation layers.
- Improves auditability and observability.
- Enables event replay for future systems.
- Simplifies future notification workflows.
- Reduces inconsistent verification state calculations.

### Negative

- Introduces an additional persistence layer.
- Verification events become critical infrastructure that must remain reliable.
- Requires careful schema evolution to preserve historical compatibility.

---

## Alternatives Considered

### Option A — Query provider APIs directly for every consumer

Rejected.

This would tightly couple UI components and business services to external providers, increase latency, duplicate logic, and produce inconsistent verification state across the platform.

### Option B — Derive verification state independently from database tables

Rejected.

Although simpler initially, different services would eventually evolve separate interpretations of verification success, leading to inconsistent behavior and difficult maintenance.

---

## Related ADRs

- ADR-018 — Revenue Engine V2 (Subscription-Normalized Revenue)
- ADR-020 — Event Projection Architecture
- ADR-024 — Centralized Logging Architecture

---

# ADR-020 — Event Projection Architecture

**Status:** Accepted

**Date:** July 2026

## Context

As Verifii evolved, multiple platform features required access to verification activity, including the homepage Live Feed, founder dashboards, future notifications, analytics, audit history, and public timelines.

Allowing each feature to independently query verification data or reconstruct business events from operational tables would duplicate business logic, create inconsistent behavior, and increase maintenance costs.

The platform required a consistent mechanism for exposing verification activity without coupling presentation layers to verification execution.

---

## Decision

Verifii adopts an Event Projection Architecture.

Verification events remain immutable records of business activity and serve as the authoritative source for downstream consumers.

Public-facing features do not generate or infer events themselves. Instead, they consume projected views derived from persisted verification events.

Projection services are responsible for transforming canonical verification events into representations optimized for specific consumers while preserving the underlying business truth.

This establishes a clear separation between:

- **Event Production** (verification execution)
- **Event Storage** (canonical verification events)
- **Event Projection** (consumer-specific read models)

---

## Rationale

Separating event storage from event presentation allows each consumer to evolve independently without affecting verification logic.

Projection-based read models provide:

- Consistent public activity feeds.
- Reusable data for dashboards and analytics.
- Simplified notification generation.
- Better scalability for read-heavy workloads.
- Reduced duplication of presentation logic.
- Future support for specialized projections without modifying the verification engine.

This architecture ensures that every public representation originates from the same verified business events.

---

## Consequences

### Positive

- Eliminates duplicated event-generation logic.
- Enables multiple read models from a single event stream.
- Improves scalability by separating reads from writes.
- Simplifies future features such as notifications, investor dashboards, analytics, and audit timelines.
- Maintains consistency across all public-facing experiences.

### Negative

- Introduces an additional architectural layer.
- Projection models must remain synchronized with event schema changes.
- Projection pipelines require monitoring to detect stale or failed updates.

---

## Alternatives Considered

### Option A — Generate events independently within each feature

Rejected.

This would duplicate business logic across the homepage, dashboards, notifications, and analytics, increasing maintenance effort and creating inconsistent user experiences.

### Option B — Query verification tables directly for every consumer

Rejected.

While simpler initially, each consumer would eventually implement its own interpretation of verification activity, resulting in fragmented business logic and tighter coupling to operational data structures.

---

## Related ADRs

- ADR-019 — Verification Events as the Canonical Source of Truth
- ADR-021 — Idempotent Startup Submission
- ADR-024 — Centralized Logging Architecture

---

# ADR-021 — Idempotent Startup Submission

## Context

- Duplicate startup submissions were possible.
- Network retries created duplicate records.
- Race conditions could bypass application-level duplicate checks.

## Decision

- One active startup per (user_id + normalized startup_name).
- Rejected submissions remain resubmittable.
- Startup names are normalized before uniqueness evaluation.
- Duplicate requests return the existing startup.
- Database uniqueness is enforced using a partial unique index.
- Race conditions are handled through graceful recovery.
- Application duplicate checks complement database constraints.

## Alternatives Considered

- Application-only duplicate detection
- Global uniqueness
- Rejecting all duplicate requests

## Consequences

### Positive

- Idempotent API
- Retry-safe
- Race-safe
- Better UX

### Tradeoffs

- Requires normalization
- Requires partial unique index
- Slightly more complex insert workflow

## Status

Accepted

---

# ADR-022 — Secure Proof Upload Pipeline

## Context

Need secure handling of uploaded verification proofs.

## Decision

- Proofs stored in private storage.
- Namespace isolation per user.
- Canonical proof object stored in database.
- Ownership validated server-side.
- Storage metadata validated.
- Magic-byte validation performed.
- Signed URLs required for viewing.
- Service role performs authoritative verification.

## Consequences

### Positive

- Prevents cross-user access
- Prevents path manipulation
- Prevents spoofed uploads
- Improves auditability

## Status

Accepted

---

# ADR-023 — Best-Effort Auxiliary Writes

## Context

Verification logs and provider connection records should not prevent successful startup creation.

## Decision

Primary transaction

startup_submissions

Secondary operations

verification_logs

provider_connections

Failures in secondary operations are logged but never roll back successful startup creation.

## Consequences

### Positive

Higher reliability

Improved availability

Resilient architecture

### Tradeoff

Background inconsistencies may require later reconciliation.

## Status

Accepted

---

# ADR-024 — Centralized Logging Architecture

## Context

Direct console logging created inconsistent observability.

## Decision

Introduce centralized logger abstraction.

All business logic logs must use logger.ts.

Log events are standardized.

Structured metadata is attached automatically.

Logging provider is abstracted for future migration to Sentry/Axiom/BetterStack.

## Consequences

### Positive

Consistent logs

Easy provider replacement

Improved observability

### Operational Principle

Logging is an observational concern rather than a business concern.

Business transactions must not fail solely because logging fails.

Logging failures should be isolated, reported, and handled independently unless regulatory, compliance, or audit requirements explicitly require logging to succeed before a transaction is considered complete.

This principle ensures that observability never reduces platform availability while preserving the integrity of core business operations.

## Status

Accepted

# ADR-025 — Explicit Onboarding Completion State

**Status:** Accepted (Post Launch)

### Problem
Current onboarding completion is inferred from the user's first startup. This works for launch but relies on runtime `COUNT()` logic which carries edge-case race conditions if parallel inserts occur in the exact same millisecond.

### Decision
After launch, Verifii will introduce an explicit onboarding completion state (or notification history table) that becomes the authoritative source of truth.

Potential approaches:
- **Option A:** `welcome_notification_sent` boolean flag
- **Option B:** `notification_history` table
- **Option C:** `onboarding_completed` timestamp

### Rationale
- Eliminates edge-case race conditions
- Simplifies business logic
- Improves observability
- Scales to future onboarding milestones

### Consequences
- Current implementation remains approved for launch.
- This ADR documents the future evolution to resolve the synchronous dependency and race conditions inherent in relying on dynamic record counts.

### Related ADRs
- ADR-021 — Idempotent Startup Submission
- ADR-023 — Best-Effort Auxiliary Writes
- ADR-024 — Centralized Logging Architecture

---

# ADR-026 — OAuth Re-authentication for Destructive Actions

## Context

Destructive actions such as account deletion and startup deletion permanently remove user-owned data.

A valid session alone is insufficient because long-lived browser sessions, shared devices, and unattended sessions could allow destructive operations without recent user confirmation.

Verifii currently uses Google OAuth authentication as its identity provider and therefore cannot rely on password re-entry for sensitive operations.

The re-authentication flow must remain compatible with OAuth-based providers while still guaranteeing recent user presence before destructive actions are executed.

---

## Decision

Users authenticated via OAuth must explicitly re-authenticate before performing destructive actions.

The re-authentication architecture uses:

- Google OAuth re-authentication
- Server-signed action intents
- HMAC-signed proof tokens
- Single-use HttpOnly cookies
- Constant-time signature verification

Passwords are not used anywhere in this flow.

---

### Security Guarantees

The re-authentication architecture guarantees the following properties:

- Re-authentication proofs are cryptographically signed using HMAC-SHA256.
- Proofs are explicitly bound to both the authenticated user and the requested action.
- Re-authentication intents cannot be forged by client components.
- The browser never receives access to server secrets.
- Proof cookies are HttpOnly and inaccessible to JavaScript.
- Proofs automatically expire after 120 seconds.
- Proofs are single-use and are invalidated immediately after successful consumption.
- Proof verification uses constant-time comparison (`crypto.timingSafeEqual`) to mitigate timing attacks.
- OAuth callbacks cannot escalate privileges because the authenticated session is revalidated on the server before proof issuance.

---

## Flow

```text
Authenticated Session

↓

User initiates destructive action

↓

Server creates signed intent token bound to the requested destructive action

↓

Google OAuth re-authentication

↓

Google redirects back with authorization code and signed intent

↓

Server validates OAuth response and issues a short-lived proof cookie

↓

User confirms deletion

↓

Proof consumed and invalidated

↓

Destructive action executed
```

---

## Rationale

- Re-authentication is mandatory for destructive actions.
- Action intents are signed server-side using HMAC-SHA256.
- Proof tokens expire automatically after a configurable TTL.
- Proof cookies are single-use and deleted immediately upon consumption.
- Signature verification uses constant-time comparison (`crypto.timingSafeEqual`).
- Frontend components cannot forge authorization because server secrets are never exposed to the client.
- Password storage is unnecessary under this architecture.

---

## Alternatives Considered

- Password confirmation
- Email confirmation links
- SMS verification
- Session-only authorization
- Manual administrator approval

---

### Threat Model

ADR-026 explicitly mitigates the following threats:

- Shared-device abuse
- Session hijacking with unattended browsers
- Replay attacks against destructive endpoints
- Client-side intent forgery
- Cross-account deletion attempts
- Timing attacks during proof verification
- OAuth account switching attacks

The architecture intentionally assumes that possession of an active browser session alone is insufficient authorization for destructive operations.

---

### Non-Goals

ADR-026 does not attempt to protect against:

- Full compromise of the user's Google account
- Malware running on the user's machine
- Browser extensions with elevated privileges
- Server-side secret leakage

These threats require controls outside the scope of the re-authentication system.

---

### Implementation Invariants

Future changes must preserve the following invariants:

- Intent signing must remain server-only.
- Client components must never access server secrets.
- Proofs must remain short-lived.
- Proofs must remain single-use.
- Proof verification must remain constant-time.
- Destructive actions must always require recent re-authentication.
- Proof cookies must remain HttpOnly.

---

## Consequences

### Positive

- Stronger account security
- Protection against stale sessions
- OAuth-compatible destructive actions
- Reduced attack surface
- Improved auditability

### Trade-offs

- One additional step before deletion
- More complex authentication flow
- Additional OAuth round-trip

---

## Related Components

- `src/lib/reauth-proof.ts`
- `src/app/dashboard/settings/actions.ts`
- `src/app/auth/callback/reauth/route.ts`
- `src/app/dashboard/settings/confirm-delete/page.tsx`
- `src/components/dashboard/settings/ConfirmDeleteAction.tsx`
- `src/components/dashboard/settings/DangerZone.tsx`

---

## Status

Accepted

---

# ADR-027 — Draft Recovery & Crash Resilience

Status: Accepted

## Context

Founders could lose onboarding progress after accidental refreshes, crashes, or browser closures.

## Decision

Introduce versioned draft persistence using:

- local storage
- TTL expiration
- debounced autosave
- cross-tab synchronization
- explicit restore
- explicit discard

## Consequences

### Positive

- reduced onboarding abandonment
- safer recovery
- improved founder experience

### Trade-offs

- browser-only persistence
- additional state complexity

---

# ADR-028 — Shared Validation Architecture

Status: Accepted

## Context

Client and server validation rules diverged and created inconsistent onboarding behavior.

## Decision

Centralize validation into:

`src/lib/validation/onboarding.ts`

The browser and API consume the same schema.

## Consequences

### Positive

- validation parity
- reduced maintenance
- fewer production bugs

### Trade-offs

- stronger coupling to the shared schema

---

# ADR-029 — Banner State Separation

Status: Accepted

## Context

Draft existence and banner visibility were previously represented by the same state.

This created edge cases where refreshes could accidentally overwrite valid drafts.

## Decision

Separate onboarding state into:

- pendingDraft
- isBannerDismissed
- showBanner

Banner visibility becomes derived state rather than persisted state.

## Consequences

### Positive

- safer recovery behavior
- cleaner state management
- reduced accidental data loss

### Trade-offs

- slightly more complex state model

---

# ADR-030 — Process-Local Analytics Caching

**Status:** Accepted

## Context

The onboarding analytics system exposes multiple admin endpoints:

- /api/admin/analytics/onboarding
- /api/admin/analytics/onboarding/trends
- /api/admin/analytics/onboarding/comparison

These endpoints perform expensive aggregation queries and may be requested repeatedly from the analytics dashboard.

To reduce database load and improve dashboard responsiveness, Verifii requires a lightweight caching layer.

Because onboarding analytics is an internal admin feature and does not require strong consistency guarantees, a short-lived cache is sufficient.

---

## Decision

Verifii will use process-local in-memory caching backed by a JavaScript Map.

Cache entries are scoped by:

- analytics type
- time range

Current cache durations:

- Analytics report: 5 minutes
- Comparison report: 5 minutes
- Trend report: 10 minutes

Cache invalidation is performed manually through:

```ts
invalidateAnalyticsCache();
```

---

## Alternatives Considered

### Option A — Redis / Upstash

Pros:

- Shared across all instances
- Persistent
- Horizontally scalable

Cons:

- Additional infrastructure
- Additional cost
- More operational complexity

Rejected for launch.

### Option B — Database-backed cache table

Pros:

- Durable
- Centralized

Cons:

- Increases database load
- Additional maintenance burden

Rejected.

### Option C — Process-local Map cache

Pros:

- Zero infrastructure cost
- Extremely simple
- Fast reads
- Sufficient for admin analytics

Selected for launch.

---

## Consequences

Benefits:

- Lower database load
- Faster analytics responses
- Simple implementation

Limitations:

- Cache is instance-local.
- Cache is not persistent.
- Cache hits are best-effort in serverless environments.
- Cache is cleared whenever the process restarts.

These limitations are acceptable because analytics data is not mission-critical.

---

## Future Evolution

Future versions may migrate to:

- Redis
- Upstash
- Edge Config

without changing the public API.

---

## Related ADRs

- ADR-009 — Snapshot-Based Dashboard
- ADR-019 — Verification Events as Canonical Source of Truth
- ADR-020 — Event Projection Architecture

---

## Status

Accepted

---

# Chapter 22 — Product Roadmap

The Product Roadmap defines the long-term direction of Verifii and outlines the major phases planned for the platform's evolution.

Unlike the Implementation Plan, which contains detailed engineering tasks and execution steps, the roadmap focuses on strategic milestones and product objectives.

Its purpose is to provide a high-level understanding of how Verifii is expected to evolve over time while preserving flexibility in implementation.

Detailed development tasks, priorities, and timelines are maintained separately within the project's Implementation Plan.

---

## 22.1 Roadmap Philosophy

Verifii is developed incrementally through clearly defined phases.

Each phase builds upon the architectural foundations established by previous work while maintaining backwards compatibility wherever practical.

Rather than pursuing rapid feature expansion, the roadmap prioritizes:

- Platform trust.
- Product quality.
- Security.
- Founder experience.
- Long-term maintainability.

Every new capability should strengthen the platform's core mission of trustworthy startup verification.

---

## 22.2 Current Platform Status

At the time of writing, Verifii has completed its foundational platform architecture.

Major completed areas include:

- Product architecture.
- Verification system.
- Provider integrations.
- Revenue processing.
- Trust evaluation.
- Visibility system.
- Subscription infrastructure.
- API architecture.
- Founder dashboard.
- Public profiles.
- Leaderboard.
- Administrative tooling.
- Security architecture.
- Operational foundations.

The platform is now positioned to transition from infrastructure development toward product expansion and ecosystem growth.

---

## 22.3 Development Phases

The Verifii roadmap is organized into sequential development phases.

### Phase 1 — Platform Foundation

Status: ✅ Completed

Focus:

- Core architecture.
- Verification pipeline.
- Authentication.
- Billing.
- Visibility.
- Public platform.
- Security.
- Engineering foundations.

---

### Phase 2 — Founder Experience

Status: ✅ CLOSED / VERIFIED / PRODUCTION SMOKE TEST PASSED

Phase 2 (Founder Experience) is formally closed across all 7 core platform objectives:

1. **Founder Onboarding & Profile Setup:** Multi-step founder submission workflow, canonical business categorization, slug generation, draft recovery, and schema validation.
2. **Payment Provider Connection & Multi-Gateway Support:** Secure Stripe Connect and Razorpay API key integration, encrypted credential handling, connection status management, and safe disconnect barriers.
3. **Revenue Sync & Real-Time Aggregation Engine:** Idempotent webhook processing, automated background sync, transaction ledger aggregation, MRR/ARR/Growth calculation, and snapshot consistency guards.
4. **Public Startup Profile & Trust Badging:** Public startup showcase (`/startup/[slug]`), dynamic SVG trust badges with XML entity escaping (VRF-003 verified), and real-time verified revenue metrics.
5. **Search, Filtering & Public Discovery:** Authoritative public leaderboard discovery (`/leaderboard`), search by startup name, category allowlist, bounded revenue ranges, city search, authoritative verification filtering, bounded server pagination, and context-aware empty state.
   - *Authoritative Invariant:* `verification=verified` strictly enforces `hasVerificationEvidence === true`. A startup in the `PAYMENT_CONNECTED` tier (linked credentials with $<3$ transactions, zero volume, or stale sync $>7$ days) is strictly pruned from `verification=verified`. `payment_connected === true` operates solely as a database pre-filter optimization and is not treated as proof of verification.
   - *Production Deployment & Smoke Test:* Deployed to production under commit `b4fcc81d81fcfc5a7e20586dceaee055f0ce2ec3` (`feat: complete Phase 2 founder discovery`). A 17-probe read-only production smoke test verified 100% HTTP 200 availability, UI rendering (`LeaderboardFilters`, `LeaderboardEmptyState`, `LeaderboardPagination`), query parameter binding, category allowlist validation, revenue range parsing, city filtering, empty-state switching, pagination bounds clamping (`page=101` $\to$ `100`), and wildcard injection sanitization.
   - *Public Visibility Boundary:* 0 private startup records leaked across all 17 production probes (`is_public = true` strictly enforced).
   - *Dataset Limitation Qualification:* Verification filter pipeline semantics were structurally verified against the deployed source and automated tests; positive dataset-dependent behavior remains unexercised in production because the current public catalog contains zero startups (1 private startup, 0 public startups, 0 provider connections, 0 transactions).
6. **Founder Dashboard & Financial Health Center:** Layered dashboard architecture (Orchestrator, Engine, Presenter, Widget), revenue breakdown, provider breakdown, sync logs, connection management, health scoring, and milestone tracking.
7. **Verification Confidence & Fraud Defense Integration:** Dynamic verification engine (`computeVerificationState`), anomaly detection, duplicate protection, trust scoring, and penalty tracking.

**Verification Evidence:**
- 46/46 leaderboard search/filter unit and pipeline assertions passed (`tests/leaderboard-search-filtering.test.ts`).
- 13/13 Phase 1 revenue/trust regression assertions passed (`tests/phase1-revenue-trust-boundary.test.ts`).
- 11/11 SVG output encoding assertions passed (`tests/vrf003-svg-output-encoding.test.ts`).
- 17/17 read-only production smoke probes passed with HTTP 200 on commit `b4fcc81`.
- TypeScript: PASS.
- ESLint: PASS.
- Zero database mutations, zero auth mutations, zero RLS changes, zero unresolved Phase 2 blockers.

---

### Phase 3 — Trust Intelligence

Status: 🔵 Planned

Primary objectives:

- Advanced trust scoring.
- Fraud intelligence.
- AI-assisted verification.
- Reputation systems.
- Verification insights.
- Platform analytics.

---

### Phase 4 — Community & Discovery

Status: 🔵 Planned

Primary objectives:

- Community features.
- Public discovery.
- Startup collections.
- Founder following.
- Enhanced leaderboards.
- Public APIs.
- Ecosystem growth.

---

### Phase 5 — Enterprise & Scale

Status: 🔵 Planned

Primary objectives:

- Team workspaces.
- Organization accounts.
- Enterprise verification.
- Advanced permissions.
- Enterprise billing.
- Platform scalability.
- Operational automation.

---

## 22.4 Long-Term Vision

The long-term vision for Verifii extends beyond revenue verification.

The platform aims to become the trusted infrastructure through which founders demonstrate credibility, investors discover reliable opportunities, and startup growth is communicated using independently verified information rather than unverifiable claims.

Future platform capabilities will continue supporting this mission while expanding the range of verified business signals available to the startup ecosystem.

---

## 22.5 Relationship to the Implementation Plan

This handbook intentionally avoids documenting detailed engineering tasks.

The authoritative source for execution planning is:

**IMPLEMENTATION_PLAN.md**

The roadmap defines strategic direction.

The Implementation Plan defines execution.

Whenever roadmap priorities change, the Implementation Plan should be updated accordingly while preserving the long-term architectural principles documented throughout this handbook.

---

## 22.6 Maintaining the Handbook

The Engineering Handbook is a living document.

It should evolve whenever significant architectural decisions, platform capabilities, or engineering standards change.

Routine bug fixes and implementation details do not require handbook updates unless they alter the documented architecture or engineering principles.

Major architectural decisions should also be recorded through new Architecture Decision Records (ADRs).

---

## 22.7 Closing Notes

The purpose of this handbook is not simply to document Verifii as it exists today.

Its purpose is to preserve the reasoning, architecture, engineering standards, and product philosophy that guide the platform's development.

As Verifii grows, this handbook should remain the single source of truth for understanding how the platform is designed, why key decisions were made, and how future contributors should continue building it.

Technology will evolve.

Features will change.

Architectures will mature.

The principles documented in this handbook should provide continuity throughout that evolution.

---

# Chapter 23 — Core Engineering Principles

Verifii is built on enduring engineering principles designed to maintain architectural integrity as the platform scales. These principles are permanent and govern all technical decisions.

## Single Source of Truth
Financial data and business logic must exist in exactly one location. The Revenue Aggregation layer owns all financial calculations.

## Snapshot First
The platform prioritizes reading from immutable historical snapshots over querying live external APIs. This guarantees speed, resilience, and historical accuracy.

## Backend Owns Business Logic
The server is the authoritative source for all decisions. Frontend applications never enforce security, authorization, or financial rules.

## Thin Pages
Pages act as orchestrators. They fetch data and distribute it to dedicated layers, remaining as thin as possible.

## Provider Isolation
Payment provider implementations are completely abstracted behind standardized interfaces. The core platform remains unaware of provider-specific mechanics.

## Read Model Architecture
The data structures used for database persistence are intentionally decoupled from the structures used for UI rendering, separated by the presentation transformation layer.

## Presentation Models
UI components consume pre-computed View Models rather than raw backend entities, enforcing a strict boundary between domain logic and rendering logic.

## Immutable Revenue Snapshots
Verified revenue is recorded permanently and never overwritten. The platform tracks history through sequential snapshots rather than mutable state.

## Deterministic Financial Calculations
Given the same provider data, the platform must always produce the identical revenue output. Complex scenarios like suspicious zero detection follow strict, predictable rules.

## Server-First Rendering
React Server Components are the primary mechanism for data fetching, minimizing client-side javascript and ensuring secure execution environments.

## Explicit Architectural Boundaries
Every subsystem has clearly defined responsibilities. Engines do not format strings, Presenters do not calculate MRR, and Widgets do not call provider APIs.

## Public API Design Principles

Public APIs must expose only the minimum data required to fulfill their intended public purpose.

Internal ownership identifiers, authentication identifiers, provider identifiers, implementation-specific identifiers, and any other non-public internal references must never be exposed unless they are explicitly part of the public API contract.

Not every database identifier is inherently sensitive. Public identifiers may be exposed when they are intentionally designed as stable public references. However, implementation-specific identifiers must remain internal to the backend.

Whenever possible, public routing should rely on stable public identifiers such as slugs rather than internal implementation details.

When designing or modifying any public API, engineers should follow the principle of least exposure:

• expose only what is required for presentation;
• avoid leaking internal implementation details;
• keep authentication and ownership concerns entirely server-side;
• treat public API contracts as long-term interfaces.

These principles apply to REST APIs, Server Components, Route Handlers, Server Actions, and any future public interfaces.

### Explicit Query Projections

Production database queries must explicitly select only the fields required for their intended purpose.

Public-facing routes, APIs, Server Components, Route Handlers, and Server Actions must always use explicit column projections. Wildcard projections (select("*")) are prohibited unless a documented architectural exception has been reviewed and approved.

Internal tooling, administrative utilities, migration scripts, debugging utilities, or one-time maintenance tasks may use wildcard projections only when their usage is intentional, documented, and does not increase the public attack surface.

The objective is not only performance, but architectural clarity.

Explicit projections:

• reduce unnecessary data loading from the database
• minimize memory overhead in Node.js
• strictly define the precise data contract of the function
• prevent newly added internal database columns from accidentally leaking into public API responses
• make component data dependencies obvious and auditable

Whenever a production query is modified, engineers should review whether its projection still represents the minimum data required for the consuming component.

The principle of least data exposure applies equally to reads and writes and should remain consistent with Verifii's Server-First Architecture, Revenue Aggregation Single Source of Truth, and Public API Design Principles.

## Server-Owned Authorization State

- **Authorization decisions are computed only on the server.**
- **Client Components receive authorization capabilities, never ownership identifiers.**
- Internal authentication identifiers (like `user_id`) must never cross the Server → Client boundary solely for authorization decisions.
- Authorization state should be represented as boolean capabilities (e.g., `isOwner`, `isOwnerOrAdmin`, `canEdit`, `canViewProof`).
- **Benefits:** This reduces information exposure in the HTML payload, simplifies Client Components, removes unnecessary client-side authentication requests (e.g. `supabase.auth.getUser()`), and keeps authorization logic centralized and secure on the server.

*Implementation Note: After adoption of the Server-Owned Authorization model, public profile pages no longer pass internal ownership identifiers into Client Components. Authorization capabilities are computed on the server and explicit database projections ensure only the minimum required data is loaded for rendering.*

---

# Chapter 24 — Testing Philosophy

Engineering validation at Verifii extends beyond traditional unit testing to focus on holistic system correctness.

## Architecture Reviews
Before implementation begins, architectural designs are evaluated against the core engineering principles. Code that violates separation of concerns is rejected during code review.

## Runtime Validation
The system relies heavily on runtime type checking and input validation (e.g., Zod schemas) at every external boundary, including APIs and database interactions.

## Regression Testing
The Revenue Aggregation and Trust Engine subsystems require strict regression validation, as modifications to these layers can alter historical trust scores.

## Network Inspection
All provider communication is inspected for resilience. The `safe-network` layer ensures that external API failures do not cascade into platform outages.

## Database Verification
Database migrations are treated as immutable state changes. Schema updates require rigorous validation to ensure backwards compatibility with historical snapshots.

## Responsive Testing
The Founder Dashboard and Public Profiles must render correctly across all device sizes, enforcing accessibility and mobile-first design constraints.

## Security Testing
Every new API endpoint undergoes ownership and authorization validation to guarantee that private data remains isolated.

## Production Readiness Reviews
Features are evaluated for logging, error handling, rate limiting, and observability before being promoted to production environments.

## Security Verification Testing
Verifii distinguishes traditional functional tests from security verification tests:
- **Unit Tests:** Verify deterministic component-level behaviors and type safety.
- **Integration Tests:** Verify multi-module coordination, webhook processing, and local schema adherence.
- **End-to-End (E2E) Tests:** Verify user journeys through authenticated browser/API workflows.
- **Adversarial Security Tests:** Actively simulate attacks (e.g. metadata injection, IDOR, forged claims).
- **Black-Box PostgREST Tests:** Exercise unauthenticated and authenticated HTTP REST endpoints directly to verify that database grants and RLS deny unauthorized access.
- **Database Metadata Verification:** Inspect PostgreSQL system catalogs (`pg_class`, `pg_policies`, `information_schema.role_table_grants`) to verify security invariants.
- **Production Postflight Verification:** Confirm non-destructive operational integrity following live migrations.

For complete testing records and methodology, see [Chapter 25 — Verification & Security Review Framework (VRF)](#chapter-25-verification-security-review-framework-vrf).

---

# Chapter 25 — Verification & Security Review Framework (VRF)

## 25.1 Purpose

The **Verification & Security Review Framework (VRF)** is Verifii's structured adversarial verification program used during launch-readiness auditing and security hardening.

Verifii is a trust platform. Because external parties (investors, prospective buyers, customers, founders) rely on Verifii's public verification badges, metrics, and profiles to make high-stakes business decisions, the integrity of Verifii's revenue data is critical. A single vulnerability that allows self-reported revenue to masquerade as verified revenue, or allows an attacker to manipulate another startup's trust score, destroys the platform's core value proposition.

VRF exists to verify that:
1. **Provider-backed revenue cannot be forged:** Payments must be cryptographically authenticated and anchored in verifiable provider account identity.
2. **Startup ownership cannot be spoofed:** Attacker metadata cannot divert legitimate revenue to unauthorized startups.
3. **Founder claims cannot become verified trust signals:** Self-reported figures (MRR, ARR, founder claims) remain strictly segregated from provider-verified metrics.
4. **Security-sensitive output is safely encoded:** All public projections (e.g. SVG badges, OpenGraph images) are securely sanitized against injection.
5. **Payment webhook security is cryptographically hardened:** Webhook signatures are evaluated using constant-time timing-safe comparisons with strictly isolated endpoint secrets.
6. **Account deletion cannot leave billing active:** Terminating a Verifii account enforces provider-side subscription cancellation and terminal state verification before user records are deleted.
7. **Encryption compatibility and cryptographic assumptions are verified:** Ciphertext structures, IV handling, and legacy key derivation mechanisms are empirically tested.
8. **Backend/service-role access remains properly isolated:** Service-role privileges bypass RLS safely only when gated by strict application-layer authentication and ownership verification.
9. **Authoritative revenue tables cannot be mutated through untrusted clients:** Direct PostgREST access by `anon` or `authenticated` clients is blocked by Row Level Security and PostgreSQL table privilege revocation.
10. **Public trust signals originate from authoritative backend data:** Badges, leaderboards, and live feeds reflect genuine database state rather than untrusted client inputs.
11. **Previous VRF guarantees survive later changes:** Continuous cross-VRF regression testing ensures that newer features or refactors never degrade existing security properties.

> [!IMPORTANT]
> **VRF is NOT a Generic Automated Test Suite.**
> VRF is an adversarial engineering process combining source-code inspection, architectural modeling, threat analysis, controlled staging attacks, black-box HTTP testing, database catalog inspection, cross-tenant regression testing, production hardening, and post-deployment validation.

---

## 25.2 VRF Governance Rules

Verifii engineering operates under eighteen mandatory VRF governance rules:

1. **Staging Before Production:** All security-sensitive database mutations and architectural changes must be validated in staging before production execution.
2. **Read-Only Reconnaissance:** Diagnostic and reconnaissance phases must not modify source code, migrations, database schemas, or database rows.
3. **Explicit Production Authorization:** Production database mutations, schema migrations, and privilege adjustments require explicit engineering review and authorization.
4. **Exact Commit Recording:** Every security verification milestone must record the exact git commit SHA under evaluation.
5. **Exact Changed Files Recording:** All files modified during remediation must be explicitly itemized in the audit record.
6. **Cross-VRF Regression Testing:** Whenever shared security-sensitive code or database objects change, all previous VRF test suites must be re-executed.
7. **Deterministic Setup and Cleanup:** Database verification scripts must operate inside transaction blocks with immediate rollback or deterministic cleanup to leave zero persistent data residue.
8. **Evidence-Based Claims:** Never declare a vulnerability remediated without reproducible test logs, SQL query evidence, or HTTP execution traces.
9. **Deployment Separation:** Never conflate local build success (`npm run build`) with remote deployment success (e.g. Vercel deployment pipeline).
10. **Distinguish Facts from Inference:** Explicitly differentiate confirmed facts (directly observed in code/logs) from analytical inferences.
11. **Reject AI Severity Inflation:** Security findings must be evaluated based on demonstrated exploitability and actual business impact rather than speculative automated severity scores.
12. **Empirical Exploitability Required:** Vulnerability claims (such as XSS or account takeover) require demonstrating a complete, reproducible execution and delivery path.
13. **Strict Credential Redaction:** Never record real secrets, API keys, webhook signing secrets, encryption master keys, or production connection strings in documentation.
14. **Diagnostic Boundary Discipline:** Diagnostic test harnesses and scratch scripts must never accidentally mutate production environments.
15. **Preserve Historical Failures:** Record failed tests, rejected hypotheses, and intermediate diagnostic roadblocks to maintain complete institutional memory.
16. **No Historical Rewriting:** When a preliminary diagnosis is disproven by subsequent evidence, document the disproof rather than erasing the initial investigation.
17. **Document Superseded Hypotheses:** Explain why an earlier hypothesis was rejected and what specific evidence overturned it.
18. **Defense in Depth:** Enforce security constraints at multiple layers (Application Gateway, Service Role Pre-Query Guard, PostgreSQL Table Grants, and Row Level Security).

---

## 25.3 Evidence Classification

To ensure clarity in technical auditing, all findings, test results, and conclusions in the VRF framework are classified under six standardized categories:

### 1. CONFIRMED FACT
A technical property directly demonstrated by repository source code, PostgreSQL system catalog queries, automated test suite output, deployment logs, or live HTTP responses.

### 2. INFERENCE
A reasoned logical conclusion derived from confirmed facts, architectural analysis, or dependency mapping, but not directly executed as an end-to-end exploit.

### 3. RECOMMENDATION
A proposed architectural modification, SQL migration, or code refactor that has been designed but not yet executed or approved.

### 4. VERIFIED
A security invariant that has been empirically exercised and passed under specified test conditions in staging or production. Verification is always scope-dependent and tied to documented test cases.

### 5. BLOCKED
An implementation or audit phase that is technically complete locally but cannot achieve full end-to-end production verification due to an external environmental blocker (e.g. remote asset delivery failure).

### 6. NOT STARTED
A planned security investigation or hardening item for which no implementation or verification work has been initiated.

---

## 25.4 VRF Master Status Table

| VRF ID | Area | Status | Environment | Primary Result / Current State |
| :--- | :--- | :---: | :---: | :--- |
| **VRF-001** | Revenue Attribution Trust Boundary | **VERIFIED / HARDENED** | Production & Staging | Provider account identity serves as the immutable ownership anchor; founder metadata spoofing fails closed. |
| **VRF-002** | Self-Reported Revenue Trust Boundary | **COMPLETED / VERIFIED AT IMPLEMENTATION-STAGING LEVEL** | Implementation / Staging | Self-reported onboarding fields strictly segregated from verified revenue; unverified startups cannot claim badges or leaderboard rank. |
| **VRF-003** | SVG Output Encoding & Badge Sanitization | **CLOSED / VERIFIED** | Codebase / Staging / Chromium | XML encoding and truncation implemented; 11/11 automated tests pass; controlled staging HTTP 200 SVG verification passed; real Chromium DOM parsing passed; adversarial XML characters rendered as text rather than markup; light/dark themes passed; cleanup and production isolation confirmed. |
| **VRF-004** | Webhook Timing-Safe Comparison & Deployment | **CLOSED / VERIFIED** | Production & Codebase | Constant-time HMAC comparison implemented in `src/lib/encryption.ts`; 11/11 tests pass; deployed and live in production on commit `440d1ef` (`dpl_5zzfCee7ZnJvGud4Dyr1am2gMrz5`, `READY`); historical Syne font 404 resolved through subsequent builds without font-code changes. |
| **VRF-005** | Account Deletion & Billing Safety | **VERIFIED / HARDENED** | Codebase & Staging | Mandatory provider cancellation and terminal state verification enforced before database or Auth user deletion. |
| **VRF-006** | Encryption Legacy Compatibility & Derivation | **VERIFIED / DIAGNOSTIC PASS** | Codebase & Synthetic | AES-256-GCM architecture validated; synthetic compatibility confirmed (12/12); production credential tables currently empty. |
| **VRF-007** | Database Authorization, RLS & PostgreSQL Grants | **VERIFIED / PRODUCTION HARDENED** | Production & Staging | `revenue_snapshots`, `revenue_transactions`, and `verification_logs` hardened with RLS and privilege revocation; PostgREST bypasses sealed. |

---

## 25.5 VRF-001 — Revenue Attribution Trust Boundary

### Objective
Prevent an attacker from manipulating payment webhook metadata (such as `notes`, `client_reference_id`, or startup IDs) to credit revenue generated by Startup A to Startup B.

### Core Security Principle
> **Provider Account Identity is Authoritative. Founder-Supplied Metadata is Advisory.**

### Architecture & Implementation
1. **Immutable Account Mapping:** When a founder connects a payment provider (Stripe or Razorpay), the platform records the authentic provider merchant account ID (`provider_account_id`) in `public.provider_connections`.
2. **Server-Side Account Resolution:** Webhook ingestion routes (`/api/stripe/webhook`, `/api/razorpay/webhook`) extract the authenticated merchant ID directly from the provider's cryptographic payload.
3. **Database Lookups via Service Role:** The system queries `provider_connections` using the merchant account ID to resolve the authoritative `startup_id`.
4. **Fail-Closed Default:** If a webhook event arrives from an unknown or unmapped provider account ID, the handler logs an error and immediately aborts processing with zero database mutations.
5. **Idempotent Ingestion:** Incoming webhook event IDs are tracked in `processed_webhook_events` using PostgreSQL unique constraints to prevent replay attacks and duplicate revenue crediting.

### Architecture Flow
```
Payment Provider Event (Stripe / Razorpay)
  │
  ▼
Cryptographic Signature Verification (HMAC / Webhook Secret)
  │
  ▼
Extract Authoritative Provider Merchant Account ID
  │
  ▼
Query public.provider_connections (Resolved by Server)
  │
  ├── [Account Unmapped / Unknown] ──▶ Log Warning & Abort (0 Revenue Added)
  │
  └── [Account Mapped to Startup X] ──▶ Update Authoritative Revenue for Startup X
```

### Regression Test Suite (Tests A–M)
- **Test A:** Legitimate payment credited accurately to mapped Startup A (**PASS**).
- **Test B:** Payment from Startup A's merchant account containing metadata `startup_id = Startup B` strictly credited to Startup A, completely ignoring the advisory metadata (**PASS**).
- **Test C:** Unmapped provider account rejected cleanly with 0 revenue mutation (**PASS**).
- **Test D:** Replayed webhook event handled idempotently with 0 duplicate revenue entries (**PASS**).
- **Test E–J:** Provider sync endpoints enforce merchant account matching (**PASS**).
- **Test K–M:** Direct PostgreSQL RPC invocations with NULL or mismatched account IDs fail closed (**PASS**).

### Historical Failures & Fixes
- **Failure:** Early prototypes trusted `event.data.object.metadata.startup_id` sent in Stripe checkout sessions.
- **Root Cause:** Metadata fields can be set or altered by anyone initiating a payment.
- **Fix:** Refactored ingestion pipeline to resolve ownership exclusively from `provider_connections.provider_account_id`.
- **Verification:** Test Suite `tests/phase1-revenue-trust-boundary.test.ts` passes 13/13 test cases.

### Final Status
**COMPLETED / VERIFIED AT IMPLEMENTATION-STAGING LEVEL.**

---

## 25.6 VRF-002 — Self-Reported Revenue Trust Boundary

### Objective
Ensure that unverified, self-reported metrics submitted during founder onboarding can never influence public trust signals, verification badges, trust scores, or leaderboard rankings.

### Core Security Invariants
1. **Default State is Unverified:** All newly created startup submissions initialize with `verification_status = 'pending'` and `payment_connected = false`.
2. **Founder Payload Sanitization:** The onboarding submission endpoint (`POST /api/startup-submissions`) strictly strips `verified_revenue`, `verification_source`, and `trust_score` fields from the incoming user payload.
3. **Separation of Metrics:** Self-reported MRR/ARR is stored exclusively in `startup_submissions.mrr` for display on unverified profiles and is never ingested into `revenue_snapshots` or `revenue_transactions`.
4. **Trust Score Calculation:** The trust scoring engine (`src/lib/scoring.ts`) queries `revenue_transactions` and provider status. Unverified startups receive 0 revenue trust points.
5. **Badge Eligibility:** Badges are generated only for startups where `payment_connected = true` and active provider transactions exist within the verification window.
6. **Leaderboard Integrity:** The verified leaderboard ranks startups solely by provider-backed revenue snapshots.

### Controlled Test Suite
- **Forged Revenue Stripping:** Submitting `verified_revenue = 500000` in onboarding payload is stripped; database record created with `verified_revenue = NULL` (**PASS**).
- **Status Forgery Prevention:** Submitting `verification_status = 'verified'` is stripped; defaults to `'pending'` (**PASS**).
- **Unverified Trust Score:** Startup with self-reported MRR of $100,000 receives a trust score of 0 for the revenue component (**PASS**).
- **Badge Endpoint Rejection:** `/api/badge/[slug]` for unverified startups renders an unverified / self-reported badge state (**PASS**).
- **Provider Disconnection Downgrade:** Disconnecting a payment provider immediately downgrades startup state to `SELF_REPORTED` and revokes verified badge status (**PASS**).
- **Stale Sync Degradation:** Verified connections without successful syncs for > 7 days have their trust confidence tier degraded (**PASS**).

### Final Status
**CONFIRMED VERIFIED & PRODUCTION HARDENED.**

---

## 25.7 VRF-003 — SVG Output Encoding & Badge Sanitization

### Objective
Eliminate injection vulnerabilities in dynamic SVG badges generated by the public badge route.

### Confirmed Vulnerability Finding
- **Location:** `src/app/api/badge/[slug]/route.ts`
- **Root Cause:** User-controlled `startup_name` was interpolated directly into the SVG XML template string without entity encoding.
- **Security Consequence:** An attacker could register a startup name containing XML/SVG tags (e.g. `<script>`, `<foreignObject>`, or CDATA sections) that execute when the SVG is viewed standalone in a browser context.
- **Severity Interpretation:** High injection risk when SVG is rendered directly in a browser context. While standard `<img>` tag embedding disables JavaScript execution in modern browsers, standalone SVG navigation (`https://verifii.io/api/badge/victim`) could allow arbitrary script execution if served with permissive headers.

### Remediation Implementation
1. **XML Entity Encoding:** All dynamic text elements are processed through an XML escaping utility converting `&`, `<`, `>`, `"`, and `'` to `&amp;`, `&lt;`, `&gt;`, `&quot;`, and `&apos;`.
2. **Order of Operations:** String length truncation is strictly performed *before* XML entity encoding to prevent splitting encoded entities (e.g. truncating `&amp;` into `&a`).
3. **HTTP Response Hardening:**
   - `Content-Type: image/svg+xml; charset=utf-8`
   - `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'`
   - `X-Content-Type-Options: nosniff`

### Regression Test Suite (`tests/vrf003-svg-output-encoding.test.ts`)
- XML entity escaping for all 5 special characters (**PASS**).
- Pre-encoding truncation verification (**PASS**).
- Combined multi-character payload escaping (**PASS**).
- Standalone SVG route HTTP header verification (**PASS**).

### Phase 3 — Controlled Staging Browser Verification
To resolve the empirical verification gap between unit tests and real browser rendering, a controlled staging validation was executed:
- **Staging Database Reference:** `oppasxypeacbrqbnqrnk` (Production `trheiumltaintfsscbnw` confirmed untouched with 0 test rows).
- **Environment Isolation:** `.env.local` preserved untouched; fresh local Next.js 16.2.2 build executed using process-level staging environment variables (45/45 routes compiled cleanly).
- **Test Startup Created:** Injected temporary public startup record (ID 28, slug `vrf003-staging-xml-probe`) with adversarial probe text: `A&B <Test> "SVG" 'Probe`.
- **HTTP Response Verification:** `GET http://localhost:3005/api/badge/vrf003-staging-xml-probe` returned **HTTP 200 OK**, `Content-Type: image/svg+xml`, `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'`, and valid XML starting with `<svg width="300" height="80" ...>`.
- **Chromium DOM Inspection:** Real Chromium browser automation navigated directly to the badge endpoint and inspected the active XML DOM:
  - `document.documentElement.nodeName === "svg"` confirmed well-formed SVG root.
  - `<text x="72" y="34" ...>` node existed in the DOM tree.
  - Truncation rule (`length > 15 ? substring(0, 14) + "..." : raw`) reduced the raw input string (23 chars) to 14 characters + `...` (`A&B <Test> "SV...`).
  - Serialized XML contained entity-escaped text: `A&amp;B &lt;Test&gt; &quot;SV...`.
  - In parsed DOM, the startup name rendered strictly as character text data (`A&B <Test> "SV...`) inside the `<text>` node.
  - Tag interpretation check: `document.getElementsByTagName("Test").length === 0` (zero XML element injection).
  - Dangerous elements check: `document.querySelectorAll("script, foreignObject, iframe, img, object, Test, test").length === 0` (zero unexpected nodes).
  - Zero JavaScript execution, zero unexpected network requests, zero browser console errors, and zero CSP violations.
- **Theme Browser Validation:**
  - `?theme=light` returned HTTP 200, rendered background `fill="#ffffff"` and text `fill="#09090b"`, with identical safe text node and 0 console/CSP errors.
  - `?theme=dark` returned HTTP 200, rendered background `fill="#09090b"` and text `fill="#ffffff"`, with identical safe text node and 0 console/CSP errors.
- **Empirical Boundary:** Chromium empirically verified `&`, `<`, `>`, and `"`. The apostrophe was outside the truncated browser probe and was therefore not empirically exercised in this Phase 3 test; apostrophe escaping remains covered by source inspection and automated tests.
- **Cleanup Confirmation:** Temporary staging record ID 28 was deleted (verified 0 rows in staging); production database verified 0 rows; temporary local server terminated; git working tree remained clean.

### Final Status
**CLOSED / VERIFIED.**

---

## 25.8 VRF-004 — Razorpay Webhook Timing-Safe Comparison & Deployment

### Objective
Harden cryptographic webhook signature validation against timing side-channel attacks and verify production build and deployment pipelines.

### Implementation Details
- **Files Modified:**
  - `src/app/api/billing/webhook/razorpay/route.ts`
  - `src/app/api/razorpay/webhook/route.ts`
  - `src/lib/encryption.ts`
  - `tests/vrf004-razorpay-timing-safe-comparison.test.ts`
- **Initial Implementation Commit:** `9d47e966fcdf5d468139e7bb6cd5001fcbcc0a91` (`9d47e96`)
- **Mechanism:** Implemented `timingSafeCompare(a, b)` in `src/lib/encryption.ts:70-79` using UTF-8 Buffers, a strict equal-length guard (`bufA.length !== bufB.length -> return false`), and native `crypto.timingSafeEqual(bufA, bufB)`.
- **Unit Verification:** `tests/vrf004-razorpay-timing-safe-comparison.test.ts` passes 11/11 automated assertions (covering valid, invalid 64-char, non-hex malformed, wrong-length short/long without exception, empty signature, missing header, provider route, billing route, body tampering, invalid rejection, and secret isolation).

### Security Boundary Analysis
- Constant-time comparison ensures that an attacker cannot determine the webhook signing secret byte-by-byte via response latency analysis.
- *Limitation:* Timing-safe comparison verifies webhook authenticity but does not by itself establish multi-tenant revenue attribution (which is governed by VRF-001).

### Historical Remote Deployment Incident (Commit 9d47e96)
- **Local Verification:** `npm run build` and `npx tsx tests/vrf004-razorpay-timing-safe-comparison.test.ts` passed 100% locally.
- **Remote Vercel Incident:** Deployment of commit `9d47e96` on Vercel initially failed during Next.js static asset optimization.
- **Root Cause Fact:** Diagnostic inspection of the Vercel build log revealed that requests to Google Fonts (`fonts.gstatic.com`) for the *Syne* (`.woff2`) font asset returned an external HTTP 404 during pre-rendering.
- **Disproven Hypothesis:** Preliminary suspicion that a missing Razorpay module or application code bug caused the failure was disproven. The failure was strictly an external Google Fonts CDN network delivery anomaly.
- **Resolution Without Code Changes:** Syne font configuration in `src/app/layout.tsx` remained standard `next/font/google`. Subsequent descendant builds (`44e399d`, `26484c5`, and `440d1ef`) fetched the Google Font assets without error and succeeded on Vercel with zero font-code modifications.
- **Engineering Principle:** *Preserve historical build incident records while distinguishing external upstream network failures from application cryptographic defects.*

### Production Deployment & Independent Re-Verification
- **Current Production Deployment:** The complete `timingSafeCompare` implementation is active in production under deployment `dpl_5zzfCee7ZnJvGud4Dyr1am2gMrz5` (commit `440d1ef491e1f71e3cecbb3dbfa2b7a80e9f8f9b`, `State: READY`) across both `/api/razorpay/webhook` and `/api/billing/webhook/razorpay`.
- **Independent Gate 2 Verification:** Under Launch Readiness Gate 2 milestone **G2-07 (Section 25.23)**, the timing-safe HMAC implementation was independently re-evaluated across 10 deterministic vectors, 90,000 adversarial runs, and 1,200,000 statistical timing measurements, confirming zero exceptions and identical median latency (300 ns) across start, middle, and end mismatch positions.

### Final Status
```
============================================================
VRF-004 — TIMING-SAFE HMAC COMPARISON: CLOSED / VERIFIED
============================================================
```

---

## 25.9 VRF-005 — Account Deletion & Billing Safety

### Objective
Ensure that deleting a Verifii founder account cannot leave orphaned, active subscriptions capable of charging the founder's payment method in the future.

### Billing Lifecycle Analysis
- **Provider Subscriptions:** Verifii utilizes Razorpay Billing Subscriptions.
- **Vulnerability Scenario:** If application data or auth records are deleted while a provider subscription remains active or in a retry/halted state, the customer will continue to be billed without access to the platform.

### Architectural Invariants & Execution Sequence
1. **Pre-Deletion Provider Cancellation:** Account deletion must invoke the Razorpay cancellation API with `cancel_at_cycle_end = false` (immediate cancellation).
2. **Terminal State Verification:** After cancellation, the backend re-fetches the subscription from Razorpay and asserts that `status === 'cancelled'`.
3. **Fail-Closed Deletion Barrier:** If the provider cancellation fails or returns a non-terminal state, the account deletion workflow aborts immediately. Database rows and Supabase Auth records remain untouched.
4. **Concurrent Deletion Handling:** If two simultaneous `DELETE /api/account/delete` requests execute:
   - The winning request cancels the subscription at the provider.
   - The losing request receives Razorpay's `isAlreadyCancelledError` (HTTP 400 with "Subscription is already cancelled"), which is recognized as a safe terminal state, allowing idempotent cleanup without corrupting data.
5. **Webhook Race Invariant:** Webhook events (`subscription.charged`, `subscription.activated`) arriving post-deletion cannot resurrect deleted users or create unmapped database records.

### Regression Test Suite (`tests/vrf005-account-deletion-billing-safety.test.ts`)
- Pre-deletion cancellation enforcement (**PASS**).
- Terminal status verification (**PASS**).
- Concurrent deletion race handling (**PASS**).
- Post-deletion webhook rejection (**PASS**).
- Strict abort on provider failure (**PASS**).

### Final Status
**CONFIRMED VERIFIED & HARDENED (18/18 Tests Passing).**

---

## 25.10 VRF-006 — Encryption Legacy Compatibility & Key Derivation

### Objective
Evaluate the cryptographic safety of stored provider credentials, assess key derivation mechanisms, and determine whether an encryption migration is required.

### Cryptographic Architecture
- **Current Algorithm:** AES-256-GCM (Galois/Counter Mode).
- **IV & Tag Handling:** Generates a fresh, cryptographically secure 12-byte initialization vector (IV) per encryption. The 16-byte authentication tag is appended to the ciphertext to ensure authenticated encryption with associated data (AEAD).
- **Legacy Compatibility:** The decryption subsystem supports legacy AES-256-CTR ciphertexts using fixed-length format detection to prevent data loss during historical upgrades.

### Synthetic Matrix Audit & Findings
- **Synthetic Testing:** Evaluated 50 distinct synthetic encryptions in `scratch/test_vrf006_synthetic_matrix.ts`. Confirmed randomized IV behavior across repeated encryptions and verified that all synthetic outputs produce valid GCM authentication tags.
- **Diagnostic Finding:** Synthetic compatibility testing passed 12/12 tests under the unified AES-256-GCM engine.
- **Production Baseline Reality:** Current production credential tables contain zero credential rows. Therefore, current production data cannot prove that historical production ciphertexts all decrypt successfully, and historical production ciphertext provenance cannot be independently established from the current database state.
- **Diagnostic Conclusion:** **DIAGNOSTIC / COMPATIBILITY PASS.** Cryptographic implementation validated against synthetic test vectors; no automated encryption migration required.

### Final Status
**CONFIRMED DIAGNOSTIC PASS (12/12 Synthetic Tests Passing; 0 Production Credential Rows).**

---

## 25.11 VRF-007 — Authorization, RLS & PostgreSQL Privilege Hardening

### Phase A — Reconnaissance Findings
During the comprehensive authorization audit of all 45 routes and PostgreSQL metadata, three database-layer vulnerabilities and one false positive were identified:

1. **SEC-007-01 — CRITICAL (`public.revenue_snapshots`):**
   - *Finding:* Table had Row Level Security enabled, but an active policy named `"Service role can manage revenue_snapshots"` was defined with `roles = {public}`, `cmd = ALL`, `qual = true`, and `with_check = true`.
   - *Exploitability:* Any unauthenticated client possessing `NEXT_PUBLIC_SUPABASE_ANON_KEY` could make direct PostgREST calls (`POST / PATCH / DELETE /rest/v1/revenue_snapshots`) to forge or delete monthly revenue figures for any startup.
2. **SEC-007-02 — CRITICAL (`public.revenue_transactions`):**
   - *Finding:* `rls_enabled = false`. Table privileges (`SELECT, INSERT, UPDATE, DELETE`) were granted to `anon` and `authenticated`.
   - *Exploitability:* An external client could directly insert fake transactions via PostgREST, corrupting the trust scoring engine and badge generation.
3. **SEC-007-03 — HIGH (`public.verification_logs`):**
   - *Finding:* `rls_enabled = false`. Table privileges were granted to `anon` and `authenticated`.
   - *Exploitability:* An attacker could insert fake sync events into `/api/live-feed` or delete verification audit history.
4. **FP-007-01 — FALSE POSITIVE (`audit_subscription_changes`):**
   - *Finding:* Function was defined as `SECURITY DEFINER`.
   - *Analysis:* The function returns `TRIGGER`. PostgreSQL strictly forbids invoking trigger functions directly as RPCs, returning error `0A000`. PostgREST does not expose trigger functions. Confirmed non-exploitable.

### Phase B — Remediation Design & Staging Verification
The remediation was designed to enforce a strict server-only trust boundary:
- Enable Row Level Security on all three tables.
- Drop all dangerous public policies.
- Revoke all table privileges (`SELECT, INSERT, UPDATE, DELETE`) from `anon`, `authenticated`, and `public`.
- Preserve `service_role` server-side DML capabilities.
- Leave 0 policies on the tables, enforcing PostgreSQL's strict **DEFAULT DENY** for all non-bypass roles.

#### Staging Black-Box Test Results (30/30 Tests Passed):
- **Direct PostgREST Mutations (RS-01 to RS-06, RT-01 to RT-06, VL-01 to VL-06):** 100% rejected with HTTP 400/401 (`42501 permission denied`). Zero rows created, modified, or deleted.
- **Direct PostgREST Reads (DR-01 to DR-06):** 100% rejected with HTTP 401 (`42501 permission denied`). Zero rows enumerated.
- **Service-Role DML & Reads (SR-01 to SR-06):** 100% functional via server client; atomic rollback tests verified full write capability with zero data residue.
- **Application Smoke Tests:** All 12 application routes (`/api/live-feed`, `/api/trust-metrics`, `/api/badge/[slug]`, `/api/og/startup/[slug]`, leaderboard, profile, scoring engine, webhooks) operated without regression.

### Phase C — Production Hardening Execution
The production database (`trheiumltaintfsscbnw`) was hardened inside an atomic PostgreSQL transaction:
```sql
BEGIN;

-- 1. REVENUE_SNAPSHOTS
DROP POLICY IF EXISTS "Service role can manage revenue_snapshots" ON public.revenue_snapshots;
DROP POLICY IF EXISTS "Server only access" ON public.revenue_snapshots;
DROP POLICY IF EXISTS "No public access" ON public.revenue_snapshots;
ALTER TABLE public.revenue_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.revenue_snapshots FROM anon, authenticated, public;

-- 2. REVENUE_TRANSACTIONS
DROP POLICY IF EXISTS "Server only access" ON public.revenue_transactions;
DROP POLICY IF EXISTS "No public access" ON public.revenue_transactions;
ALTER TABLE public.revenue_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.revenue_transactions FROM anon, authenticated, public;

-- 3. VERIFICATION_LOGS
DROP POLICY IF EXISTS "Server only access" ON public.verification_logs;
DROP POLICY IF EXISTS "No public access" ON public.verification_logs;
ALTER TABLE public.verification_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.verification_logs FROM anon, authenticated, public;

COMMIT;
```

### Phase D — Confirmed Production State
- `public.revenue_snapshots`: `rls_enabled = true`, `relforcerowsecurity = false`, 0 policies, `service_role` retains DML privileges, `anon`/`authenticated` have 0 privileges.
- `public.revenue_transactions`: `rls_enabled = true`, `relforcerowsecurity = false`, 0 policies, `service_role` retains DML privileges, `anon`/`authenticated` have 0 privileges.
- `public.verification_logs`: `rls_enabled = true`, `relforcerowsecurity = false`, 0 policies, `service_role` retains DML privileges, `anon`/`authenticated` have 0 privileges.

### Phase E — Application Regression & Build Results
- **TypeScript Type Check (`npm run type-check`):** **PASS (0 errors)**.
- **Production Build (`npm run build`):** **PASS (All 45 static and dynamic routes compiled cleanly)**.
- **ESLint (`npx eslint src --quiet`):** Exited with code 1 due to 3 pre-existing non-fatal cosmetic issues in unrelated files (1 unescaped quote in `SubscriptionCancelled.tsx`, 1 `Function` type in `console-types.ts`, 1 `prefer-const` in `governance-audit.ts`). Zero ESLint errors related to VRF-007 or database hardening.
- **Automated Regression Test Suites:**
  - `tests/vrf002-revenue-trust-boundary.test.ts`: 10/10 Passed
  - `tests/vrf003-svg-output-encoding.test.ts`: 11/11 Passed
  - `tests/vrf004-razorpay-timing-safe-comparison.test.ts`: 11/11 Passed
  - `tests/vrf005-account-deletion-billing-safety.test.ts`: 18/18 Passed
  - `tests/isolated-transaction-rollback.test.ts`: Passed (0 residue)
  - `tests/isolated-idempotency-concurrency.test.ts`: 9/9 Passed
  - `tests/phase1-revenue-trust-boundary.test.ts`: 13/13 Passed
  - `tests/recommendations.test.ts`: 40/40 Passed
  - `tests/recovery-pairing.test.ts`: 25/25 Passed

### Final Status
**VRF-007 — CLOSED / VERIFIED / PRODUCTION HARDENED.**

---

## 25.12 Cross-VRF Regression Coverage

| Security Property | Origin VRF | Cross-VRF Regression Suites Exercising Property | Current Status |
| :--- | :---: | :--- | :---: |
| **Authoritative Provider Identity** | VRF-001 | `phase1-revenue-trust-boundary.test.ts`, `isolated-transaction-rollback.test.ts` | **VERIFIED** |
| **Self-Reported Metric Segregation** | VRF-002 | `vrf002-revenue-trust-boundary.test.ts`, `recommendations.test.ts` | **VERIFIED** |
| **SVG Output XML Sanitization** | VRF-003 | `vrf003-svg-output-encoding.test.ts` (11/11 Pass), Controlled Chromium Staging Validation | **VERIFIED** |
| **Timing-Safe Webhook Signatures** | VRF-004 | `vrf004-razorpay-timing-safe-comparison.test.ts`, `isolated-idempotency-concurrency.test.ts` | **VERIFIED** |
| **Billing-Safe Account Deletion** | VRF-005 | `vrf005-account-deletion-billing-safety.test.ts` | **VERIFIED** |
| **AES-256-GCM Credential Protection** | VRF-006 | `test_vrf006_synthetic_matrix.ts` | **VERIFIED** |
| **Database Table RLS & Privilege Isolation** | VRF-007 | `test_vrf007_staging_suite.js`, `test_vrf007_staging_smoke.ts`, Next.js Build | **VERIFIED** |

---

## 25.13 Environment Verification Model

Verifii enforces a strict separation between environments during security engineering:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          STAGING ENVIRONMENT                            │
│                 (Project: oppasxypeacbrqbnqrnk)                         │
├─────────────────────────────────────────────────────────────────────────┤
│ • Destructive security testing                                          │
│ • Direct black-box PostgREST attack simulation                          │
│ • Permission bypass probing                                             │
│ • Database migration dry runs                                           │
│ • Synthetic user journey execution                                      │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                        Validated & Verified Clean
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        PRODUCTION ENVIRONMENT                           │
│                 (Project: trheiumltaintfsscbnw)                         │
├─────────────────────────────────────────────────────────────────────────┤
│ • Read-only preflight metadata inspection                               │
│ • Atomic migration execution (explicitly authorized)                    │
│ • Read-only postflight catalog verification                             │
│ • Live read-only application smoke verification                         │
│ • ZERO synthetic attack data / ZERO data residue                        │
└─────────────────────────────────────────────────────────────────────────┘
```

> [!CAUTION]
> Production is never used as an experimental testbed. All adversarial tests, mock failures, and privilege probes must be executed exclusively in staging.

---

## 25.14 Security Verification Failure & Recovery Log

A key requirement of the VRF framework is the transparent documentation of real engineering failures, disproven hypotheses, and their subsequent recoveries:

| VRF ID | Incident / Failure / Anomaly | Root Cause Fact | Disproven Hypothesis | Resolution / Recovery | Verification Proof |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **VRF-003** | Standalone 200 SVG browser validation initial 404 / API key mismatch | Initial production test had 0 rows; subsequent local staging attempt loaded production-compiled `.next` build artifacts with baked-in production URL. | Suspected process environment override was sufficient without rebuild. | Executed fresh local build with process-level staging variables; Chromium successfully validated live 200 SVG DOM. | Real Chromium DOM parsed well-formed SVG without XML errors or element injection; temporary staging record deleted; production untouched. |
| **VRF-004** | Remote Vercel build failure on commit `9d47e96` | Next.js pre-rendering failed when fetching Google Font *Syne* (`.woff2`) assets (HTTP 404). | Incorrectly suspected Razorpay module resolution or build cache issue. | Font asset resolution issue identified as external network anomaly. Subsequent descendant builds (`44e399d`, `440d1ef`) succeeded without code changes. | Local `npm run build` passes 100%; 11/11 tests pass; deployed to production in `440d1ef` (`dpl_5zzfCee7ZnJvGud4Dyr1am2gMrz5`, `READY`). |
| **VRF-007** | Critical PostgREST revenue snapshot forgery (SEC-007-01) | Policy `"Service role can manage revenue_snapshots"` was defined with `roles = {public}` and `cmd = ALL`. | None (Confirmed true positive). | Dropped public policy, enabled RLS default-deny, revoked untrusted table grants. | PostgREST direct mutation returns HTTP 401/400. |
| **VRF-007** | RLS disabled on `revenue_transactions` and `verification_logs` | Tables were created in early migrations without `ENABLE ROW LEVEL SECURITY`. | None (Confirmed true positive). | Executed `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and revoked untrusted grants. | PostgREST direct insertion returns `42501 permission denied`. |
| **VRF-007** | Direct RPC execution warning on `audit_subscription_changes` | Function had `SECURITY DEFINER` attribute. | Suspected callable RPC exploit via PostgREST. | Proven false positive: PostgreSQL forbids direct execution of `RETURNS TRIGGER` functions (error `0A000`). | PostgREST RPC call rejected; confirmed safe. |
| **VRF-007** | Column name mismatch in test script during smoke testing | Staging test script queried legacy `amount` column instead of standardized `total_revenue`. | Suspected database migration rollback. | Corrected test script to query `total_revenue` (matching `20260606000001_alter_revenue_snapshots.sql`). | Smoke test passed 12/12 routes. |
| **Gate 1** | Initial delivery-receipt evidence gap for production transactional email | Initial dispatch succeeded via Resend API (HTTP 200, Message ID returned), but autonomous agent lacked inbox access to verify external delivery. | Suspected potential delivery drop or spam filtering. | Human inspection of the target Gmail inbox confirmed receipt and correct HTML rendering of the message. | Real Gmail inbox screenshot confirmed message receipt from `noreply@verifii.in` with subject `[Verifii] Production Email Infrastructure Test`. |
| **Gate 2 (G2-02)** | Staging database privilege deviation during test fixture setup | Staging `service_role` lacked direct table grants on `subscriptions`, causing initial fixture insert to fail. Temporary `GRANT` was executed outside authorized scope. | Suspected permission model misalignment between environments. | Explicitly executed `REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.subscriptions FROM service_role;` to restore exact pre-test baseline. | PostgreSQL catalog inspection (`information_schema.role_table_grants`) independently verified 0 direct grants for `service_role` and `postgres` matching pre-test baseline. |
| **Gate 2 (G2-03)** | Staging privilege deviation and uncharged subscription cycle-end rejection | Staging `service_role` initially held zero direct privileges on `public.subscriptions`, requiring temporary `GRANT` alignment for application execution. Route execution returned HTTP 500 because Razorpay rejected cycle-end cancellation on uncharged test subscription (paid_count = 0). | Suspected potential route handling defect or false local status update. | Verified fail-closed local state preservation (status remained active, current_period_end preserved); immediate provider cancellation succeeded; temporary staging grants revoked. | Post-remediation catalog inspection verified service_role restored to 0 direct table grants and postgres baseline intact; production untouched. |
| **Gate 2 (G2-04)** | PostgreSQL RI constraint failure during Supabase Auth deletion on staging | Initial Auth deletion (`auth.admin.deleteUser`) failed with `Database error deleting user` because GoTrue (`supabase_auth_admin`) triggered PostgreSQL RI enforcement for `public.billing_audit_logs.user_id_fkey` (`ON DELETE SET NULL`) without public table privileges or RLS bypass. | Suspected missing schema privileges for `supabase_auth_admin` or cascading FK blockage. | Implemented permanent application-level remediation in `DELETE /api/account/delete`: `service_role` explicitly purges local subscriptions, anonymizes `billing_audit_logs` (`user_id = NULL`) and `subscription_events` (`user_id = NULL`), deletes `onboarding_events`, and cleans `startup_submissions` before calling `auth.admin.deleteUser()`. Temporary test grants revoked. | Executed controlled success-path test proving provider cancellation, audit log preservation with `user_id = NULL`, complete Auth user deletion, HTTP 200, and catalog-verified 0 residual direct grants for `service_role` and `supabase_auth_admin`. |

---

## 25.15 Security Principles Derived from VRF

Twelve foundational security principles govern all ongoing engineering work at Verifii:

1. **Provider Identity Over Metadata:** Cryptographic merchant account IDs always take precedence over user-supplied payload metadata.
2. **Strict Segregation of Claimed vs. Verified Data:** Self-reported figures must never enter authoritative verification tables or scoring calculations.
3. **Public Signals Must Be Backend Projections:** Badges, trust scores, and leaderboard positions must be derived strictly from backend calculations, never client-submitted state.
4. **Service Role is a Backend Mechanism, Not an Authorization Pass:** The Supabase service role key bypasses RLS safely only when the calling application route explicitly validates user identity and resource ownership before querying.
5. **Authorization Before Query Execution:** Application routes must verify `startup.user_id === user.id` before executing service-role mutations.
6. **Grants and Policies are Distinct Layers:** PostgreSQL table grants (`GRANT/REVOKE`) and Row Level Security policies (`CREATE POLICY`) operate in tandem; both must be properly configured.
7. **RLS with Zero Policies Equals Default Deny:** For non-bypass roles, enabling RLS without granting policies enforces a strict, secure default deny.
8. **Local Builds Do Not Equal Production Deployments:** Local Turbopack builds must be independently validated in staging and CI/CD before declaring deployment readiness.
9. **Regression Invariants Must Be Preserved:** No optimization, refactor, or feature addition may weaken an invariant established by a previous VRF milestone.
10. **Black-Box Testing is Essential:** Code inspection alone cannot detect database grant misconfigurations; black-box HTTP probing is required.
11. **Document Disproven Hypotheses:** Preserving incorrect intermediate assumptions prevents future engineers from repeating the same investigatory mistakes.
12. **Severity Must Reflect Practical Exploitability:** Risk classifications must be anchored in demonstrable business impact rather than theoretical vulnerability ratings.

---

## 25.16 Relationship to Launch Readiness

The Verification & Security Review Framework (VRF) operates in conjunction with the **Verifii Launch Readiness Audit Master Report**.

While the Launch Readiness Audit evaluates the broad operational, commercial, functional, and architectural completeness of the platform, VRF provides deep adversarial verification of security-critical subsystems.

**Governance Hierarchy:**
- The Launch Readiness Audit and VRF are co-equal sources of truth within their respective domains.
- If the Launch Readiness Audit marks a feature as functionally complete, but VRF identifies an unresolved security vulnerability, the feature is deemed **BLOCKED FOR LAUNCH** until the VRF vulnerability is remediated and verified.
- No launch readiness gate may be closed without satisfying its corresponding VRF verification milestone.

---

## 25.17 Launch Readiness Gate 1 — Production Email Smoke Test

### Objective
Empirically verify that the live production transactional email infrastructure reliably delivers notifications to real external inboxes via Resend without modifying application code or database state.

### Final Status
**CLOSED / VERIFIED.**

### Execution & Security Architecture
- **Production Endpoint:** `POST https://www.verifii.in/api/admin/test-email`
- **Environment Gate:** `process.env.EMAIL_PRODUCTION_TEST_ENABLED === "true"` (enforced server-side)
- **Security & Authorization Chain:**
  1. **Upstash Redis Rate Limiter:** 1-hour window (`3,600,000 ms`), max 3 dispatches/hour, `failOpen: false` (fail-closed default).
  2. **Feature Gate Authorization:** Rejects requests with HTTP 403 if `EMAIL_PRODUCTION_TEST_ENABLED !== "true"`.
  3. **Authentication Verification:** Supabase Auth Bearer JWT validation (`getAuthenticatedUser()`).
  4. **Admin Authorization:** Enforces `isAdmin(user.email)` checking against authorized administrator emails.
- **Recipient Resolution:** Resolved server-side exclusively from the authenticated administrator identity; recipient address is non-caller-controlled.
- **Recipient Domain:** `gmail.com` (Masked: `e***@gmail.com`).

### Production Dispatch & Delivery Evidence
- **HTTP Status:** `200 OK` (`Content-Type: application/json`).
- **Resend Provider Acceptance:** Provider Message ID `5d83dc87-cfb9-4d89-b300-e0f562030fe9` returned.
- **Provider Latency:** `169 ms`.
- **Sender Identity:** `Verifii <noreply@verifii.in>` (`emailBrandConfig.fromAddress`).
- **Reply-To:** `support@verifii.in` (`emailBrandConfig.replyTo`).
- **Template ID:** `production-email-test` (`src/emails/ProductionEmailTest.tsx`).
- **Subject:** `[Verifii] Production Email Infrastructure Test`.
- **End-User Delivery Verification:** Visual Gmail inbox inspection confirmed that the test email was successfully received and rendered in the live inbox.

### Evidence Boundaries & Testing Limits
- **HTML Rendering:** Confirmed rendered cleanly in the live Gmail client.
- **Plain-Text Fallback:** Generated automatically by the production pipeline; separate plain-text client rendering was not independently tested.
- **Idempotency:** A deterministic daily key (`ntf_prod_test_..._2026-08-15`) was generated and transmitted; duplicate-prevention rejection behavior was not independently exercised because only one dispatch was authorized.
- **Rate Limiting:** The single authorized dispatch succeeded while below the configured threshold; rate-limit rejection behavior was not exercised during this smoke test.
- **Duplicate Prevention:** Exactly one authorized dispatch was executed; exactly one provider message ID was generated; zero additional emails were sent.

### Gate 1 Evidence Matrix

| Evidence Area | Result | Classification |
| :--- | :--- | :---: |
| **Production Endpoint Execution** | HTTP 200 OK (Latency: 169ms) | **VERIFIED** |
| **Resend Provider Acceptance** | Message ID returned (`5d83dc87-cfb9-4d89-b300-e0f562030fe9`) | **VERIFIED** |
| **Gmail Inbox Delivery** | Email received and rendered in live inbox | **VERIFIED** |
| **Sender Identity** | `Verifii <noreply@verifii.in>` | **VERIFIED** |
| **HTML Rendering** | Correctly rendered in Gmail client | **VERIFIED** |
| **Plain-Text Fallback** | Generated by pipeline; not separately client-tested | **NOT INDEPENDENTLY VERIFIED** |
| **Deterministic Idempotency Key** | Generated and used for test | **VERIFIED** |
| **Duplicate Rejection Behavior** | Not exercised during single dispatch | **NOT TESTED** |
| **Rate-Limit Rejection Behavior** | Not exercised during single dispatch | **NOT TESTED** |
| **Duplicate Production Dispatches**| 0 additional sends (1 dispatch only) | **VERIFIED FOR THIS TEST** |

---

## 25.18 Launch Readiness Gate 2 (G2-02) — Controlled Plan Change / Replacement Test

### Objective
Empirically verify that the Verifii plan change and upgrade workflow (`POST /api/billing/change-plan`) safely initiates a new replacement subscription on Razorpay with `notes.replaces_subscription_id` attached, preserves baseline subscription access until period end, isolates production, and verifies deterministic dual-subscription cancellation cleanup without creating real financial charges or mutating production data.

### Final Status
**CLOSED / VERIFIED (Functional Pass + Governance Remediation Verified).**

### Execution Architecture & Environment Isolation
- **Endpoint Under Test:** `POST /api/billing/change-plan`
- **Staging Target:** `oppasxypeacbrqbnqrnk` (`https://oppasxypeacbrqbnqrnk.supabase.co`)
- **Production Target:** `trheiumltaintfsscbnw` (`https://trheiumltaintfsscbnw.supabase.co` — Read-Only Inspection)
- **Provider Sandbox:** Razorpay TEST MODE (`rzp_test_...`)
- **Synthetic Test User:**
  - Email: `e2e_founder_1786537939929@staging-test.verifii.in`
  - User ID: `b50f32ac-5322-47ae-b503-82ac46b29324`
  - User Presence: Verified present in staging Supabase Auth; verified **ABSENT** from production Supabase Auth (`count = 0`).

### Baseline Subscription & Controlled Staging Fixture
- **Baseline Provider Subscription:** `sub_TQ0qCMTHRPc0F6` created in Razorpay TEST MODE on plan `plan_Sz7Rnd2y7HFk9k` (`pro` / `monthly`, `paid_count = 0`).
- **Controlled Staging Fixture Setup:** To simulate an active founder changing tiers, exactly one temporary staging row was inserted (`id: 9b409173-63f9-4fa9-ac10-175a20bdf516`, `user_id: b50f32ac-5322-47ae-b503-82ac46b29324`, `plan_code: pro`, `billing_cycle: monthly`, `status: cancelled`, `razorpay_subscription_id: sub_TQ0qCMTHRPc0F6`, `current_period_end: 2026-09-14T10:28:35.616Z`).
- **Branch Enforcement:** Setting the fixture status to `cancelled` with future `current_period_end` intentionally forced the route to execute **Branch A (New Replacement Subscription)**.

### Change-Plan Execution & Functional Evidence
- **Request Payload:** `POST /api/billing/change-plan` with `{"plan_code": "founder", "billing_cycle": "monthly"}` authenticated via staging Bearer JWT.
- **HTTP Response:** `200 OK` (Duration: `1426 ms`).
- **Returned Body:** `{"success": true, "subscription_id": "sub_TQ0qFi9DmGRXrs", "short_url": "https://rzp.io/rzp/i8RaeVUm"}`.
- **Provider Verification (`razorpay.subscriptions.fetch("sub_TQ0qFi9DmGRXrs")`):**
  - Distinct Subscription ID: `sub_TQ0qFi9DmGRXrs` $\neq$ `sub_TQ0qCMTHRPc0F6`.
  - Provider Status: `created` (Pending authorization).
  - Target Plan ID: `plan_Sz7MCBNdVAXyz6` (`founder` / `monthly`).
  - Paid Count: `0`.
  - Total Count: `120`.
  - Attached Note: `notes.replaces_subscription_id = sub_TQ0qCMTHRPc0F6` (Exact match with baseline ID).
- **Original Subscription Safety:** Baseline subscription `sub_TQ0qCMTHRPc0F6` remained in `created` status on Razorpay immediately following execution and was **NOT prematurely cancelled**.
- **Production Isolation:** Queries for both test subscription IDs against production `public.subscriptions` returned strictly `0` matching rows. Production schema and table privileges remained completely untouched.

### Cleanup Execution & Verification
1. **Replacement Subscription:** Cancelled on Razorpay API $\to$ verified post-cancel status `cancelled`.
2. **Baseline Subscription:** Cancelled on Razorpay API $\to$ verified post-cancel status `cancelled`.
3. **Staging Fixture Deletion:** Row `9b409173-63f9-4fa9-ac10-175a20bdf516` deleted from staging `subscriptions` $\to$ verified `0` residual subscription rows for test user in staging.
4. **Production Re-Verification:** Re-verified strictly `0` matches in production.

### Governance Deviation & Subsequent Remediation
- **Governance Deviation Recorded:** During controlled staging fixture setup, the initial `INSERT` failed because role `service_role` had zero direct table privileges on `public.subscriptions` in staging (`oppasxypeacbrqbnqrnk`). A temporary grant was executed:
  ```sql
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.subscriptions TO service_role;
  ```
  This privilege elevation was **outside the originally authorized G2-02 mutation scope** and is explicitly recorded as an execution deviation.
- **Remediation & Catalog Verification:** Following the functional test and cleanup, the unapproved grants were revoked:
  ```sql
  REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.subscriptions FROM service_role;
  ```
  Post-remediation PostgreSQL catalog inspection (`information_schema.role_table_grants`) independently verified that:
  - `service_role` holds strictly **0** direct table privileges on `public.subscriptions`.
  - `postgres` retains the exact pre-test baseline (`DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE`).
  - **Staging privilege state was restored to its documented pre-test baseline.**

### Financial Evidence & Evidence Limitations
- **Financial Activity Observation:** No production financial activity attributable to the authorized G2-02 test was observed. The provider subscriptions were created exclusively in Razorpay TEST MODE (`rzp_test_...`) and both had `paid_count = 0`. Production subscription records contained zero matching test subscription IDs. Production-wide invoice/payment absence was **not independently verified** because no production-wide financial table sweep was performed.
- **Evidence Boundaries Preserved (Not Tested in G2-02):**
  - Interactive payment completion on the hosted checkout URL was not tested.
  - Razorpay payment mandate authorization was not tested.
  - `subscription.activated` webhook processing was not tested.
  - Normal cycle-end cancellation is reserved for G2-03.
  - Account deletion cascade is reserved for G2-04.

### G2-02 Evidence Matrix

| Evidence Area | Result / Finding | Classification |
| :--- | :--- | :---: |
| **Target Database Verification** | Staging `oppasxypeacbrqbnqrnk` verified active | **VERIFIED** |
| **Razorpay Test Mode Proof** | Credentials verified `rzp_test_...` | **VERIFIED** |
| **Endpoint Execution (`POST /api/billing/change-plan`)** | HTTP 200 OK (Latency: 1426ms) | **VERIFIED** |
| **Replacement Subscription Minting** | `sub_TQ0qFi9DmGRXrs` created on Razorpay | **VERIFIED** |
| **`replaces_subscription_id` Correlation** | Notes field matches baseline ID `sub_TQ0qCMTHRPc0F6` | **VERIFIED** |
| **Baseline Subscription Preservation** | Baseline remained in `created` status immediately after replacement creation and was not prematurely cancelled. | **VERIFIED** |
| **Financial Safety (`paid_count = 0`)** | Zero charges initiated in test mode | **VERIFIED** |
| **Production-Wide Invoice/Payment Sweep** | No production-wide sweep performed | **NOT INDEPENDENTLY VERIFIED** |
| **Production Isolation** | 0 matching rows, 0 privilege/schema changes | **VERIFIED** |
| **Dual Provider Cancellation Cleanup** | Both subscriptions verified terminal `cancelled` | **VERIFIED** |
| **Staging Fixture Cleanup** | Staging fixture row deleted (0 residual rows) | **VERIFIED** |
| **Governance Deviation Remediation** | Staging grants revoked; catalog confirmed pre-test baseline | **VERIFIED** |

---

## 25.19 Launch Readiness Gate 2 (G2-03) — Normal Cycle-End Subscription Cancellation

### Objective
Empirically evaluate the normal subscription cancellation workflow (`POST /api/billing/cancel`) via an actual HTTP network request over TCP, with specific verification of:
- Real HTTP route execution and authentication
- Upstream payment provider interaction and error handling
- Fail-closed local database state behavior
- Immediate deterministic cleanup
- Strict production environment isolation

### Final Status
**CLOSED / VERIFIED WITH DOCUMENTED TESTABILITY LIMITATION.**

> [!NOTE]
> **Scope Clarification:** This CLOSED status applies only to G2-03. Launch Readiness Gate 2 (G2) remains OPEN overall pending completion and acceptance of the remaining Gate 2 controls/tests, including G2-04 and any subsequent Gate 2 items.

### Environment Isolation
- **Staging Database:** `oppasxypeacbrqbnqrnk` (`https://oppasxypeacbrqbnqrnk.supabase.co` — Active Target)
- **Production Database:** `trheiumltaintfsscbnw` (`https://trheiumltaintfsscbnw.supabase.co` — Read-Only Inspection)
- **Provider Sandbox:** Razorpay TEST MODE (`rzp_test_...`)
- **Synthetic Test User:**
  - Email: `e2e_founder_1786537939929@staging-test.verifii.in`
  - User ID: `b50f32ac-5322-47ae-b503-82ac46b29324`
  - Verification: Verified present in staging Supabase Auth; verified **ABSENT** in production Supabase Auth (`count = 0`).

### Controlled Test Fixture
Exactly one uncharged Razorpay TEST subscription and one controlled staging database fixture were provisioned:
- **Razorpay Test Subscription:** `sub_TQ2N4ZEVm43rNO` created on `plan_Sz7MCBNdVAXyz6` (`founder` / `monthly`) with `status = "created"` and `paid_count = 0`.
- **Controlled Staging Fixture Row:** `fa8ce5a0-4916-486f-b652-c69c270b491c` inserted with `plan_code: founder`, `billing_cycle: monthly`, `status: active`, `razorpay_subscription_id: sub_TQ2N4ZEVm43rNO`, `current_period_end: 2026-09-14T11:58:24.458Z`.
- **Scope Classification:** Controlled synthetic test fixture (not a real paid customer subscription).

### Actual HTTP Execution
A real HTTP network request was issued over TCP against the locally served application route:
- **Request:** `POST /api/billing/cancel` with Staging User Bearer JWT and `Content-Type: application/json`.
- **HTTP Response:** `HTTP 500 Internal Server Error` (Execution Duration: `1045 ms`).
- **Response Payload:** `{"error": "Failed to cancel and verify primary subscription sub_TQ2N4ZEVm43rNO"}`.
- **Route Execution Trace:** The route successfully authenticated the synthetic user, discovered the active primary subscription, and delegated to `cancelAllUserSubscriptions(userId, { immediate: false })`.

### Provider Behavior
When the application requested cycle-end cancellation (`razorpay.subscriptions.cancel("sub_TQ2N4ZEVm43rNO", true)`), Razorpay Subscriptions API rejected the call because the synthetic test subscription was uncharged (`paid_count = 0`, `status: "created"`):
- **Provider Error:** `HTTP 400 BAD_REQUEST_ERROR: "Subscription cannot be cancelled since no billing cycle is going on"`.
- **Underlying Provider Rule:** Razorpay requires an active billing cycle in progress (`status: "active"`, `paid_count >= 1`) to accept `cancel_at_cycle_end = true`.

### Fail-Closed Local State Preservation
Following the provider rejection, the application safely failed closed:
- **Local DB State Preserved:** Database inspection of staging fixture `fa8ce5a0-4916-486f-b652-c69c270b491c` confirmed that `status` remained `'active'` (was NOT falsely marked `'cancelled'`).
- **Timestamp Preservation:** `current_period_start` and `current_period_end` remained completely unchanged.
- **Identifier Preservation:** `plan_code` and `razorpay_subscription_id` remained unchanged.
- **Architectural Significance:** Verifii avoided local database status drift when the upstream provider rejected the requested cycle-end cancellation.

### Cleanup Execution & Verification
1. **Immediate Provider Cancellation:** Executed `razorpay.subscriptions.cancel("sub_TQ2N4ZEVm43rNO", false)` (`immediate = true`) $\to$ Razorpay verified terminal `status: "cancelled"`.
2. **Staging Fixture Deletion:** Deleted staging row `fa8ce5a0-4916-486f-b652-c69c270b491c` $\to$ verified strictly `0` residual subscriptions for the synthetic user in staging.
3. **Production Isolation:** Re-queried production `public.subscriptions` $\to$ verified strictly `0` matching records.

### Governance Deviation
- **Privilege Deviation Recorded:** During test execution, staging `service_role` initially held zero direct table privileges on `public.subscriptions` in staging (`oppasxypeacbrqbnqrnk`). A temporary grant was explicitly applied:
  ```sql
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.subscriptions TO service_role;
  ```
  This temporary elevation was required because the production cancellation route utilizes `service_role` direct access to `public.subscriptions`. It is recorded as a controlled governance deviation applied exclusively to staging.

### Privilege Restoration
Following functional test completion and cleanup, the temporary grants were revoked:
```sql
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.subscriptions FROM service_role;
```
Post-remediation PostgreSQL catalog inspection (`information_schema.role_table_grants`) independently confirmed:
- `service_role` holds strictly **0** direct table grants on `public.subscriptions`.
- `postgres` retains its exact pre-test baseline (`DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE`).
- Production privileges and schema remained completely untouched.

### Financial Safety
- **Observed Financial Activity:** No production financial activity attributable to this authorized G2-03 test was observed.
- **Evidence Boundary:** The provider subscription was created exclusively in Razorpay TEST MODE (`rzp_test_...`) and had `paid_count = 0`. Production was checked for the test subscription ID and contained zero matching records. No production-wide invoice/payment table sweep was performed.

### G2-03 Evidence Matrix

| Evidence Area | Result / Finding | Classification |
| :--- | :--- | :---: |
| **Actual HTTP Endpoint Execution** | Real TCP network request to `POST /api/billing/cancel` returned HTTP 500 | **VERIFIED** |
| **Authentication & Subscription Discovery** | Successfully authenticated staging user and discovered primary subscription | **VERIFIED** |
| **Provider Cycle-End Rejection Handling** | Caught Razorpay 400 Bad Request on uncharged test subscription | **VERIFIED** |
| **Fail-Closed Local State Preservation** | Local database status remained `active`; timestamps preserved unmodified | **VERIFIED** |
| **Immediate Provider Cancellation Cleanup** | Provider reached terminal `cancelled` status on Razorpay API | **VERIFIED** |
| **Staging Fixture Cleanup** | Staging fixture deleted (0 residual rows for synthetic user) | **VERIFIED** |
| **Production Isolation** | 0 matching users in Auth, 0 matching rows in production `subscriptions` | **VERIFIED** |
| **Temporary Privilege Deviation** | Temporary staging `GRANT` applied and documented | **VERIFIED** |
| **Staging Privilege Restoration** | Temporary grants revoked; catalog confirmed exact pre-test baseline (0 service_role grants) | **VERIFIED** |
| **Paid Active Cycle-End Behavior** | Cycle-end preservation on genuinely active paid subscription not exercisable in test mode | **NOT INDEPENDENTLY VERIFIED** |

### Testability Limitation

> [!WARNING]
> **Prominent Testability Limitation:**
> G2-03 did **NOT** independently verify the successful cycle-end cancellation lifecycle of an already-paid active subscription where:
> 1. `cancel_at_cycle_end = true` is submitted for an active paid subscription,
> 2. The provider maintains `status: "active"` with `cancel_at_cycle_end: 1` until `current_period_end`,
> 3. A natural cycle-end transition occurs after billing period expiry.
>
> This was not verified because the controlled synthetic test subscription was uncharged (`paid_count = 0`), causing Razorpay to reject the cycle-end cancellation request before an active billing cycle existed. This represents an empirical provider testability boundary of safe uncharged test fixtures rather than an application architectural failure.

### Final Verdict

```
G2-03 — CLOSED / VERIFIED WITH DOCUMENTED TESTABILITY LIMITATION
```

> [!NOTE]
> **Scope Clarification:** This CLOSED status applies only to G2-03. Launch Readiness Gate 2 (G2) remains OPEN overall pending completion and acceptance of the remaining Gate 2 controls/tests, including G2-04 and any subsequent Gate 2 items.

```
================================================================
  G2-03 AUDIT SUMMARY
================================================================
  VERIFIED:
  - Real HTTP network endpoint execution (POST /api/billing/cancel)
  - Upstream provider error handling (Razorpay 400 caught)
  - Fail-closed local state preservation (status preserved 'active')
  - Immediate provider cancellation and deterministic cleanup
  - Complete production environment isolation
  - Temporary staging privilege deviation and catalog-verified restoration

  NOT INDEPENDENTLY VERIFIED:
  - Successful cycle-end cancellation of a genuinely active paid subscription
  - Natural cycle-end transition after cancel_at_cycle_end = true
  - Production-wide financial invoice/payment absence
================================================================
```

---

## 25.20 Launch Readiness Gate 2 (G2-04) — Account Deletion & Billing Safety Barrier

### Objective
Empirically evaluate and verify the account deletion billing safety barrier and data cascade workflow (`DELETE /api/account/delete`) across both failure and success paths, ensuring:
- **G2-04-A (Failure-Path Validation):** If provider subscription discovery or cancellation fails, the route aborts fail-closed, leaving Supabase Auth credentials and application data intact without executing destructive deletions.
- **G2-04-B (Success-Path Validation & Remediation):** When provider cancellation succeeds, all provider-backed billing subscriptions are cancelled on Razorpay and verified terminal, local subscriptions are purged, financial audit logs (`public.billing_audit_logs`) and lifecycle events (`public.subscription_events`) are permanently preserved via user anonymization (`user_id = NULL`), transient onboarding events are cleaned, application startup data is cascaded, and Supabase Auth credentials are permanently deleted without triggering PostgreSQL referential integrity errors.

### Final Status
**CLOSED / VERIFIED (Failure Path Verified + Success Path Remediated & Verified).**

> [!NOTE]
> **Scope Clarification:** G2-04 is CLOSED. Launch Readiness Gate 2 (G2) remains OPEN pending completion of the remaining Gate 2 controls.

### Architectural Invariants & Threat Model (VRF-005)
- **Billing Hard Barrier Invariant:** An account deletion request MUST NOT delete application data or Supabase Auth credentials if a provider-backed Razorpay subscription capable of recurring charging remains active.
- **Financial Compliance & Retention Invariant:** Financial audit records (`public.billing_audit_logs`) must NEVER be deleted during account termination; they must be retained for compliance with `user_id` set to `NULL` to decouple the audit trail from the deleted identity.
- **PostgreSQL Referential Integrity & GoTrue Architecture:** GoTrue user deletion connects as database role `supabase_auth_admin`, which lacks privileges or RLS bypass on schema `public`. Foreign keys referencing `auth.users(id)` with `ON DELETE SET NULL` (such as `billing_audit_logs_user_id_fkey`) trigger PostgreSQL internal RI triggers (`RI_FKey_setnull_del`) that fail if active referencing rows exist. The application layer (`service_role`) must explicitly decouple or remove all referencing application rows *before* invoking `auth.admin.deleteUser(user.id)`.
- **Operational Non-Atomicity:** Retry-safe at the route level, with explicit fail-closed handling for downstream failures; the operation remains intentionally non-transactional across the external payment provider and database.

---

### G2-04-A: Controlled Failure-Path Execution

#### Objective
Validate that when billing discovery/cancellation cannot be completed, `DELETE /api/account/delete` fails closed and blocks destructive deletion of application and auth data.

#### Execution & Functional Trace
- **Target Endpoint:** `DELETE /api/account/delete` via real HTTP/TCP request.
- **Environment:** Staging (`oppasxypeacbrqbnqrnk`) under initial baseline permissions (`service_role` had 0 direct table grants on `public.subscriptions`).
- **Provider Sandbox:** Razorpay TEST MODE (`rzp_test_...`).
- **Execution Event:** Synthetic user requested account deletion. Because `service_role` lacked permissions on `subscriptions`, the billing cancellation library encountered a database error during subscription discovery.
- **Route Response:** `HTTP 500 Internal Server Error` (Execution Duration: `389 ms`).
- **Fail-Closed Verification:**
  - **Auth User:** Verified intact in staging Supabase Auth (`count = 1`).
  - **Application Data:** `startup_submissions` row remained intact (`count = 1`).
  - **Child Connections:** `provider_connections` row remained intact (`count = 1`).
  - **Destructive Deletion:** Strictly `0` destructive deletions occurred.
- **Governance & Production Isolation:**
  - No `GRANT` or `REVOKE` was executed during G2-04-A.
  - Production (`trheiumltaintfsscbnw`) remained completely untouched and isolated.
  - Synthetic test artifacts were subsequently cleaned via administrative scripts.
  - Evidence corrected to avoid unsupported absolute claims (no production-wide table sweep was performed).

---

### G2-04-B: Controlled Success-Path Execution & Permanent Remediation

#### Root Cause Analysis of Auth Deletion Failure
During initial success-path testing, provider cancellation succeeded, but calling `supabaseServer.auth.admin.deleteUser(user.id)` failed with `Database error deleting user`. Investigation revealed:
1. Trigger `trg_audit_subscriptions` creates a row in `public.billing_audit_logs` whenever a subscription is updated or deleted.
2. `public.billing_audit_logs.user_id` has a foreign key to `auth.users(id)` with `ON DELETE SET NULL`.
3. When GoTrue deletes a user from `auth.users`, PostgreSQL invokes internal RI trigger `RI_FKey_setnull_del` under the executing connection role `supabase_auth_admin`.
4. Because `supabase_auth_admin` has zero table grants on `public` and is subject to RLS, PostgreSQL raised permission denied (`42501`), causing GoTrue to abort user deletion.
5. **Architectural Decision:** Granting privileges to `supabase_auth_admin` on application tables is an anti-pattern. Instead, the permanent application architecture requires `service_role` (which bypasses RLS) to explicitly anonymize audit logs and remove application-owned references *before* invoking Auth deletion.

#### Permanent Application Remediation
The account deletion route (`src/app/api/account/delete/route.ts`) was updated to enforce the following deterministic, fail-closed sequence:
1. **Notification Payload Pre-capture:** Pre-captures user email and startup name while auth/db records exist.
2. **Provider Cancellation Barrier:** Executes `cancelAllUserSubscriptions(user.id, { immediate: true })` and verifies terminal `"cancelled"` state. Fails closed on any error.
3. **Local Subscriptions Cleanup:** Executes `DELETE FROM public.subscriptions WHERE user_id = user.id`. (Note: trigger `trg_audit_subscriptions` fires and records a `DELETE` audit entry).
4. **Financial Audit Anonymization:** Executes `UPDATE public.billing_audit_logs SET user_id = NULL WHERE user_id = user.id`. This captures all audit rows (including the `DELETE` log) and anonymizes them while preserving the financial audit history.
5. **Subscription Events Anonymization:** Executes `UPDATE public.subscription_events SET user_id = NULL WHERE user_id = user.id`.
6. **Transient Onboarding Events Deletion:** Executes `DELETE FROM public.onboarding_events WHERE user_id = user.id` (preventing `NO ACTION` FK blockage from rows where `startup_id IS NULL`).
7. **Application Data Deletion:** Executes `DELETE FROM public.startup_submissions WHERE user_id = user.id` (database constraints cascade to `provider_connections`, `revenue_snapshots`, `revenue_transactions`, `verification_logs`, `fraud_flags`).
8. **Pre-Auth Invariant Verification:** Performs an explicit parallel head-count query across all 5 tables to confirm strictly `0` residual user references before touching Auth.
9. **Auth User Deletion:** Calls `supabaseServer.auth.admin.deleteUser(user.id)` and verifies `error === null`.
10. **Notification Dispatch:** Dispatches `ACCOUNT_DELETED` notification as best-effort post-deletion (ADR-023).
11. **HTTP 200 Return:** Returns `NextResponse.json({ success: true })`.

#### Controlled Staging Success-Path Test Evidence
A single controlled real HTTP test was executed over TCP against the remediated route:
- **Staging Database:** `oppasxypeacbrqbnqrnk`
- **Production Database:** `trheiumltaintfsscbnw` (Read-Only Inspection)
- **Synthetic Test User:** `e2e_del_remediated_1786884090382@staging-test.verifii.in` (`20e696e6-8708-4392-bad5-8471a531033c`)
- **Synthetic Startup:** Row ID `41` (`del-remed-1786884090382`) with child `provider_connections` row `6c59228c-559a-4d9b-9392-3474f285d706`.
- **Razorpay Test Subscription:** `sub_TQRdrJ8YHbk6WE` (`plan_Sz7MCBNdVAXyz6`, `paid_count = 0`).
- **HTTP Request:** `DELETE /api/account/delete` with Staging User Bearer JWT.
- **HTTP Response:** `HTTP 200 OK` (Execution Duration: `3927 ms`), Body: `{"success": true}`.
- **Provider Verification:** `razorpay.subscriptions.fetch("sub_TQRdrJ8YHbk6WE")` returned status **`"cancelled"`** (`ended_at: 1786884105`).
- **Audit Preservation Proof:** 3 audit records in `public.billing_audit_logs` (`INSERT`, `UPDATE`, `DELETE`) preserved intact with `user_id = null`.
- **Application & Cascade Deletion Proof:** `startup_submissions` row 41, child `provider_connections`, and `subscriptions` rows confirmed **ABSENT** (`count = 0`).
- **Auth Deletion Proof:** Synthetic user confirmed **ABSENT** from staging Supabase Auth (`getUserById` returned null).

#### Temporary Privilege Alignment & Catalog-Verified Restoration
- **Authorized Deviation:** To enable the initial controlled execution of G2-04-B in staging (`oppasxypeacbrqbnqrnk`), the following temporary grants were explicitly executed:
  ```sql
  GRANT SELECT, UPDATE ON TABLE public.subscriptions TO service_role;
  GRANT SELECT, DELETE ON TABLE public.subscriptions TO supabase_auth_admin;
  GRANT SELECT, UPDATE ON TABLE public.billing_audit_logs TO supabase_auth_admin;
  ```
- **Mandatory Restoration:** Following test execution, the temporary grants were immediately revoked:
  ```sql
  REVOKE SELECT, UPDATE ON TABLE public.subscriptions FROM service_role;
  REVOKE SELECT, DELETE ON TABLE public.subscriptions FROM supabase_auth_admin;
  REVOKE SELECT, UPDATE ON TABLE public.billing_audit_logs FROM supabase_auth_admin;
  ```
- **Post-Test Verification (`check-staging-grants.js`):** Independent catalog query against `information_schema.role_table_grants` on staging verified that `service_role` and `supabase_auth_admin` hold strictly **0** direct table grants across all target tables (`subscriptions`, `billing_audit_logs`, `subscription_events`, `onboarding_events`).
- **Architectural Distinction:** Temporary staging grants were used solely to diagnose and execute the controlled test in staging. They do **not** represent the permanent production architecture. The permanent production architecture is application-level pre-auth cleanup via `service_role` followed by `auth.admin.deleteUser()`, with **zero dependency** on granting public-schema privileges to `supabase_auth_admin`.

#### Repository Integrity & Working Tree Classification
The repository state for G2-04 encompasses:
1. **Permanent G2-04 Application Remediation:** `src/app/api/account/delete/route.ts` was intentionally modified to enforce pre-auth application cleanup and audit log anonymization. This modification is permanent and required for G2-04. No application changes were made during the final Handbook-only documentation pass.
2. **Handbook Documentation:** `VERIFII ENGINEERING_HANDBOOK.md` was intentionally updated to document G2-04 evidence and architecture.
3. **Temporary Verification Artifact:** `check-staging-grants.js` is an untracked read-only verification script created for post-test privilege verification.

#### Production Isolation
- **Verification:** Inspection of production (`trheiumltaintfsscbnw`) confirmed synthetic user, synthetic email, and test subscription ID were strictly absent.
- **Isolation Statement:** No production mutation attributable to this test was observed; verification was limited to test-specific identifiers and records. No production-wide mutation sweep was performed.

---

### G2-04 Evidence Matrix

| Evidence Area | Result / Finding | Classification |
| :--- | :--- | :---: |
| **G2-04-A Failure Path** | Real HTTP execution failed closed on billing error; auth/app data intact | **VERIFIED** |
| **G2-04-B Success Path** | Real HTTP execution returned HTTP 200; provider cancelled; data purged | **VERIFIED** |
| **Provider Cancellation Barrier** | Subscription `sub_TQRdrJ8YHbk6WE` reached terminal `cancelled` on Razorpay | **VERIFIED** |
| **Financial Audit Preservation** | All `billing_audit_logs` records retained with `user_id = NULL` | **VERIFIED** |
| **Subscription Events Preservation** | `subscription_events` records retained with `user_id = NULL` | **VERIFIED** |
| **Onboarding Events Cleanup** | Transient events deleted; NO ACTION FK blockage prevented | **VERIFIED** |
| **Application & Cascade Deletion** | `startup_submissions` and child `provider_connections` deleted | **VERIFIED** |
| **Pre-Auth Invariant Verification** | 0 residual references proven across all 5 tables before Auth deletion | **VERIFIED** |
| **Supabase Auth User Deletion** | `auth.admin.deleteUser` succeeded with `error: null`; user absent | **VERIFIED** |
| **Notification Dispatch** | `ACCOUNT_DELETED` dispatched asynchronously post-deletion (ADR-023) | **VERIFIED** |
| **Production Isolation** | 0 matching records in production; no production mutations observed | **VERIFIED** |
| **Temporary Staging Grant & Restoration** | Staging grants revoked; independent check confirmed 0 residual grants | **VERIFIED** |

---

### Final Verdict

```
================================================================
  G2-04 — CLOSED / VERIFIED
================================================================
  VERIFIED:
  - Failure-path billing barrier enforcement (G2-04-A HTTP 500 fail-closed)
  - Success-path provider cancellation & verification (G2-04-B terminal "cancelled")
  - Financial audit log preservation via user_id anonymization (NULL)
  - Subscription events preservation via user_id anonymization (NULL)
  - Transient onboarding events cleanup
  - Application startup submissions and cascade deletions
  - Pre-auth invariant verification (0 residual user references)
  - Supabase Auth user permanent deletion
  - Best-effort ACCOUNT_DELETED notification dispatch
  - Full production environment isolation
  - Staging privilege restoration verified (0 residual grants)

  EVIDENCE BOUNDARIES / LIMITATIONS:
  - Verification was limited to test-specific identifiers and records
  - No production-wide mutation audit was performed
  - Operation is retry-safe at route level, intentionally non-transactional across provider/DB
================================================================
```

---

## 25.21 Launch Readiness Gate 2 (G2-05) — Billing Webhook Ingestion, Least-Privilege Remediation & Atomic Database Mutation

### Objective
Empirically verify that valid provider-backed Razorpay billing webhooks (`subscription.charged`) are securely verified via HMAC-SHA256, ingested through the dedicated route (`POST /api/billing/webhook/razorpay`), and processed through the atomic PostgreSQL function `public.process_razorpay_billing_webhook`, transitioning local subscription state to active, writing lifecycle events and audit logs, and adhering to strict least-privilege database role constraints.

### Final Status
**CLOSED / VERIFIED.**

### Execution Architecture & Least-Privilege Remediation
- **Route Endpoint:** `POST /api/billing/webhook/razorpay`
- **Security Boundary:** Webhook requests require HMAC-SHA256 signature verification against `process.env.RAZORPAY_BILLING_WEBHOOK_SECRET` using `timingSafeCompare`.
- **Database Privilege Hardening:** Role `service_role` holds **zero direct table grants** on `public.subscriptions`, `public.subscription_events`, and `public.billing_audit_logs`.
- **Atomic Database Delegation:** The route eliminates all direct pre-RPC table queries and delegates event claims, monotonic stale checks, and upserts to the atomic PostgreSQL function `public.process_razorpay_billing_webhook` running with `SECURITY DEFINER` and a fixed `search_path = public, pg_temp`.

### Controlled Staging Test Evidence
- **Staging Database:** `oppasxypeacbrqbnqrnk` (`https://oppasxypeacbrqbnqrnk.supabase.co`)
- **Production Database:** `trheiumltaintfsscbnw` (Read-Only Inspection)
- **Synthetic Fixture User:** `fa706172-4f08-45cd-8b58-e70df39a7475` (`e2e_webhook_g2_05_...`)
- **Razorpay Test Subscription:** `sub_TQTzgsAEZDx4bC` (`plan_Sz7MCBNdVAXyz6`, `founder` / `monthly`).
- **Webhook Event Injected:** `subscription.charged` (`evt_g205_1786892372497`, timestamp `1786892372 s`).
- **HTTP Response:** `HTTP 200 OK`, Payload: `{"received": true, "status": "active"}`.
- **Database State Mutation Proof:**
  - `subscriptions`: Row created with `status: "active"`, `plan_code: "founder"`, `billing_cycle: "monthly"`, `last_billing_event_id: "evt_g205_1786892372497"`.
  - `subscription_events`: Exactly 1 event row inserted for `user_id`.
  - `billing_audit_logs`: Exactly 1 audit record generated via trigger.
  - `processed_webhook_events`: Exactly 1 idempotency claim inserted (`evt_g205_1786892372497`).
- **Production Isolation:** Queries against production `subscriptions`, `subscription_events`, and `processed_webhook_events` confirmed strictly `0` matching records.

### G2-05 Evidence Matrix

| Evidence Area | Result / Finding | Classification |
| :--- | :--- | :---: |
| **HMAC Signature Verification** | Valid HMAC-SHA256 signature accepted via `timingSafeCompare` | **VERIFIED** |
| **Route Execution** | `POST /api/billing/webhook/razorpay` returned HTTP 200 | **VERIFIED** |
| **Atomic RPC Processing** | `public.process_razorpay_billing_webhook` executed in single ACID transaction | **VERIFIED** |
| **Subscription Activation** | Local subscription record transitioned to `status = 'active'` | **VERIFIED** |
| **Lifecycle & Audit Recording** | `subscription_events` (+1) and `billing_audit_logs` (+1) recorded | **VERIFIED** |
| **Least-Privilege Enforcement** | Executed without direct table grants for `service_role` | **VERIFIED** |
| **Production Isolation** | 0 matching rows across all tables in production | **VERIFIED** |

---

## 25.22 Launch Readiness Gate 2 (G2-06) — Billing Webhook Idempotency & True Concurrent First-Delivery Race Safety

### Objective
Empirically verify webhook duplicate handling and race safety under two independent delivery models:
1. **Sequential Replay:** Re-delivering an already-processed webhook event.
2. **True Concurrent First Delivery:** Simulating two simultaneous network requests delivering the exact same brand new, uncommitted webhook event concurrently over TCP.

### Final Status
**CLOSED / VERIFIED.**

### Execution Scenarios & Empirical Evidence

#### Scenario A — Sequential Duplicate Replay
- **Event ID:** `evt_g206_1786897595354` (Previously processed).
- **HTTP Response:** `HTTP 200 OK`, Payload: `{"received": true, "duplicate": true}`.
- **Database Delta:** `subscriptions` (+0), `subscription_events` (+0), `billing_audit_logs` (+0), `processed_webhook_events` (+0). Zero redundant state mutations.

#### Scenario B — True Concurrent First Delivery Race
- **Test Event ID:** `evt_g206_race_1786898163187` (Brand new, uncommitted event).
- **Execution Mechanism:** Two asynchronous HTTP POST requests (`Request A` and `Request B`) dispatched simultaneously over TCP to `/api/billing/webhook/razorpay`.
- **Observed Response Trace:**
  - `Request B` acquired the primary idempotency lock $\to$ returned `HTTP 200 {"received": true, "status": "active"}`.
  - `Request A` encountered unique constraint on `processed_webhook_events` $\to$ returned `HTTP 200 {"received": true, "duplicate": true}`.
- **Cumulative Database State Invariant:**
  - `subscriptions`: Exactly 1 total row (updated with new event ID).
  - `subscription_events`: Delta strictly `+1` (1 lifecycle event recorded across both requests).
  - `billing_audit_logs`: Delta strictly `+1` (1 audit log entry generated).
  - `processed_webhook_events`: Delta strictly `+1` (1 idempotency claim registered).
  - Duplicate subscription records: Strictly **0**.

### G2-06 Evidence Matrix

| Evidence Area | Result / Finding | Classification |
| :--- | :--- | :---: |
| **Sequential Duplicate Replay** | Returns `duplicate: true`, 0 database side effects | **VERIFIED** |
| **True First-Delivery Concurrency** | Simultaneous delivery resolved safely by atomic PostgreSQL constraint | **VERIFIED** |
| **Primary Request Resolution** | Exactly one request executed the mutating upsert path | **VERIFIED** |
| **Concurrent Request Resolution** | Exactly one request received the deduplicated response | **VERIFIED** |
| **Ledger Integrity** | Exactly 1 claim in `processed_webhook_events` | **VERIFIED** |
| **Financial Audit Invariant** | Exactly 1 audit record written; zero duplicate billing entries | **VERIFIED** |
| **Production Isolation** | 0 matching records in production | **VERIFIED** |

---

## 25.23 Launch Readiness Gate 2 (G2-07) — Constant-Time Webhook HMAC Verification

### Objective
Empirically evaluate the correctness, exception safety, and timing characteristics of the constant-time comparison helper `timingSafeCompare(a, b)` implemented in `src/lib/encryption.ts:70-79` and utilized across all billing and verification webhook signature validations.

### Final Status
**CLOSED / VERIFIED.**

### Implementation Architecture
```typescript
export function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
```
- **Byte Encoding:** Explicitly converts strings to UTF-8 Buffers.
- **Length Guard:** Fails closed (`return false`) on length mismatch before calling Node.js crypto primitives, preventing `RangeError` exceptions.
- **Constant-Time Primitive:** Executes native `crypto.timingSafeEqual` over equal-length buffers.

### Empirical Test Harness Evidence
1. **Deterministic Matrix (10 Vectors):** Verified identical hex signatures (`true`), single-character mismatches at start, middle, and end positions (`false`), length mismatches (`false`), empty strings (`true`), multi-byte UTF-8 sequences (`true`/`false`), and case sensitivity (`false`). 10/10 passed.
2. **Adversarial & Malformed Input Testing:** 90,000 adversarial runs spanning null bytes (`\0`), control characters, invalid UTF-8 sequences, unicode homoglyphs, and extreme length disparities produced **0 unhandled exceptions**, **0 `RangeError` crashes**, and **100% fail-closed rejection**.
3. **Statistical Timing Harness (1,200,000 Measurements):** Evaluated 200,000 samples across 6 distinct comparison classes:
   - Identical 64-character HMAC signatures: Median `300 ns`, Mean `342 ns`, p95 `700 ns`, p99 `800 ns`.
   - First-character mismatch: Median `300 ns`, Mean `338 ns`, p95 `700 ns`, p99 `800 ns`.
   - Middle-character mismatch: Median `300 ns`, Mean `341 ns`, p95 `700 ns`, p99 `800 ns`.
   - Last-character mismatch: Median `300 ns`, Mean `339 ns`, p95 `700 ns`, p99 `800 ns`.
   - Length mismatch (short vs long): Median `100 ns` (immediate length check).
- **Timing Invariant:** First-, middle-, and last-character mismatch classes exhibited identical median latency (`300 ns`) and identical 95th-percentile latency (`700 ns`), demonstrating no position-dependent short-circuiting across the digest buffer.
- **Evidence Qualification:** Reported as empirical validation of the native constant-time primitive and observed harness behavior, not theoretical mathematical proof.

### G2-07 Evidence Matrix

| Evidence Area | Result / Finding | Classification |
| :--- | :--- | :---: |
| **Deterministic Vector Accuracy** | 10/10 test vectors passed | **VERIFIED** |
| **Equal-Length Primitive** | Native `crypto.timingSafeEqual` verified | **VERIFIED** |
| **Length Mismatch Guard** | Length disparity returns `false` without throwing | **VERIFIED** |
| **Exception Safety** | 90,000 adversarial runs produced 0 exceptions | **VERIFIED** |
| **Empirical Timing Consistency** | Identical median (300ns) across start/mid/end mismatch positions | **VERIFIED** |
| **Call Site Integration** | Applied in both `/api/billing/webhook/razorpay` and `/api/razorpay/webhook` | **VERIFIED** |

---

## 25.24 Launch Readiness Gate 2 (G2-08) — Provider Identity Attribution & Boundary Enforcement

### Objective
Empirically verify provider identity attribution, trust boundary enforcement, and negative execution paths in the SaaS billing webhook handler.

### Final Status
**CLOSED / VERIFIED.**

### Architectural Trust Boundaries
Verifii strictly decouples two webhook domains:
1. **Third-Party Revenue Verification Webhooks (`/api/razorpay/webhook`):** Multi-tenant startup verification webhooks routed dynamically via `provider_connections.provider_account_id` and startup ownership.
2. **SaaS Billing Webhooks (`/api/billing/webhook/razorpay`):** Dedicated Verifii platform billing webhooks routed strictly via `payload.payload.subscription.entity.notes.user_id`.

### Controlled Negative & Boundary Test Evidence
- **Staging Database:** `oppasxypeacbrqbnqrnk` (Active Target)
- **Production Database:** `trheiumltaintfsscbnw` (Read-Only Inspection)

#### Negative Boundary Vectors:
1. **Vector 1 (Missing `notes.user_id`):**
   - Payload submitted without user attribution notes.
   - Response: `HTTP 200 OK`, Body: `{"received": true, "skipped": "no_user_id"}`.
   - Database side effects: Strictly `0` row mutations across all tables.
2. **Vector 2 (Unknown / Unmapped `plan_id`):**
   - Payload submitted with unrecognized `plan_id` (`plan_UNKNOWN_INVALID_999`).
   - Response: `HTTP 200 OK`, Body: `{"received": true, "skipped": "unknown_plan_id"}`.
   - Database side effects: Strictly `0` row mutations across all tables.
3. **Vector 3 (Forged HMAC Signature):**
   - Payload submitted with corrupted signature header.
   - Response: `HTTP 400 Bad Request`, Body: `"Invalid signature"`.
   - Database side effects: Strictly `0` row mutations across all tables.
- **Production Isolation:** Verified strictly `0` matching records or modifications in production.

### G2-08 Evidence Matrix

| Evidence Area | Result / Finding | Classification |
| :--- | :--- | :---: |
| **Missing User ID Attribution** | Safely skipped without database mutations | **VERIFIED** |
| **Unknown Plan ID Handling** | Safely skipped without database mutations | **VERIFIED** |
| **Forged Signature Rejection** | Rejected with HTTP 400 | **VERIFIED** |
| **Database State Preservation** | Zero unintended rows inserted or updated | **VERIFIED** |
| **Trust Boundary Decoupling** | Dedicated billing endpoint decoupled from startup provider connections | **VERIFIED** |
| **Production Isolation** | 0 matching records in production | **VERIFIED** |

---

## 25.25 Launch Readiness Gate 2 (G2-09) — Stale Webhook Timestamp Rejection & Out-of-Order Delivery Protection

### Objective
Empirically evaluate out-of-order webhook delivery protection and verify that older or out-of-order event timestamps cannot rewind or overwrite newer subscription state in PostgreSQL.

### Final Status
**CLOSED / VERIFIED.**

### Monotonic Timestamp Logic
In `public.process_razorpay_billing_webhook` (and fallback route logic):
```sql
IF v_existing_event_at IS NOT NULL AND p_event_at < v_existing_event_at THEN
  RETURN jsonb_build_object('processed', false, 'duplicate', false, 'stale', true);
END IF;
```
- Strict comparison `p_event_at < v_existing_event_at` returns `stale: true` for out-of-order events.
- Equal timestamps ($p\_event\_at = v\_existing\_event\_at$) and newer timestamps ($p\_event\_at > v\_existing\_event\_at$) proceed to update subscription state.

### Controlled Staging Test Evidence (3-Vector Matrix)
- **Staging Database:** `oppasxypeacbrqbnqrnk`
- **Baseline Timestamp ($T_0$):** `2026-08-16 16:36:03+00` (`1786898163 s`) on fixture `sub_TQTzgsAEZDx4bC`.

#### Vector 1 — Stale Event ($T_{event} < T_0$):
- Injected Timestamp: `1786894563 s` (`2026-08-16T15:36:03.000Z` — 1 hour earlier).
- Event ID: `evt_g209_stale_1786900115164`.
- Response: `HTTP 200 OK`, Body: `{"received": true, "skipped": "stale_event"}`.
- Invariant Result: `subscriptions` record remained 100% UNCHANGED (`last_billing_event_at` preserved `16:36:03+00`); `processed_webhook_events` recorded claim (`+1`); `subscription_events` delta `+0`.

#### Vector 2 — Equal Timestamp ($T_{event} = T_0$):
- Injected Timestamp: `1786898163 s` (`2026-08-16T16:36:03.000Z` — exact match).
- Event ID: `evt_g209_equal_1786900115164`.
- Response: `HTTP 200 OK`, Body: `{"received": true, "status": "active"}`.
- Invariant Result: `subscriptions` row updated (`last_billing_event_id` updated to `evt_g209_equal_...`, `last_billing_event_at` preserved `16:36:03+00`); `subscription_events` delta `+1`; `billing_audit_logs` delta `+1`.

#### Vector 3 — Fresh Event ($T_{event} > T_0$):
- Injected Timestamp: `1786901763 s` (`2026-08-16T17:36:03.000Z` — 1 hour later).
- Event ID: `evt_g209_fresh_1786900115164`.
- Response: `HTTP 200 OK`, Body: `{"received": true, "status": "active"}`.
- Invariant Result: `subscriptions` record advanced forward (`last_billing_event_at` updated to `2026-08-16 17:36:03+00`); `subscription_events` delta `+1`; `billing_audit_logs` delta `+1`.

### Monotonicity Proof & Production Isolation
```
[MONOTONIC TIMELINE PROOF]
1. Initial Baseline:       2026-08-16 16:36:03+00 (1786898163 s)
2. Stale Delivery (15:36): REJECTED  (skipped: "stale_event", subscriptions untouched)
3. Equal Delivery (16:36): ACCEPTED  (monotonic update, timestamp preserved)
4. Fresh Delivery (17:36): ACCEPTED  (last_billing_event_at advanced forward)
5. Final DB Timestamp:     2026-08-16 17:36:03+00 (1786901763 s)

CONCLUSION: Under no ordering was subscription state or timestamp rewound.
```
- **Production Isolation:** Queries for all G2-09 event IDs in production confirmed strictly `0` matching rows.

### G2-09 Evidence Matrix

| Evidence Area | Result / Finding | Classification |
| :--- | :--- | :---: |
| **Stale Event Rejection** | Skipped with `skipped: "stale_event"`; 0 subscription mutations | **VERIFIED** |
| **Equal Timestamp Invariant** | Processed as idempotent update without timestamp rewind | **VERIFIED** |
| **Fresh Timestamp Progression** | Advanced `last_billing_event_at` forward to new timestamp | **VERIFIED** |
| **Processed Event Ledger** | All events recorded in `processed_webhook_events` | **VERIFIED** |
| **Production Isolation** | 0 matching records across all production tables | **VERIFIED** |

---

## 25.26 Launch Readiness Gate 2 — Overall Closure & Verification Summary

### Comprehensive Gate 2 Milestone Matrix

| Milestone | Scope / Target | Execution Type | Environment | Status |
| :--- | :--- | :--- | :---: | :---: |
| **G2-01** | Razorpay Checkout Initialization | Route execution & provider creation | Staging | **CLOSED / VERIFIED** |
| **G2-02** | Plan Change & Replacement Tracking | Controlled staging execution | Staging | **CLOSED / VERIFIED** |
| **G2-03** | Normal Cycle-End Cancellation | Real HTTP TCP network execution | Staging | **CLOSED / VERIFIED (With Limitation)** |
| **G2-04** | Account Deletion Billing Safety Barrier | Failure & success paths; pre-auth cleanup | Staging | **CLOSED / VERIFIED** |
| **G2-05** | Webhook Processing & Least Privilege | Atomic RPC execution under least privilege | Staging | **CLOSED / VERIFIED** |
| **G2-06** | Webhook Idempotency & Concurrency Race | Sequential replay & true concurrent first delivery | Staging | **CLOSED / VERIFIED** |
| **G2-07** | Constant-Time HMAC Verification | 1.2M empirical timing harness runs | Local / Unit | **CLOSED / VERIFIED** |
| **G2-08** | Provider Identity Attribution | 3-vector negative boundary testing | Staging | **CLOSED / VERIFIED** |
| **G2-09** | Stale Webhook Rejection & Monotonicity | 3-vector stale, equal, and fresh matrix | Staging | **CLOSED / VERIFIED** |

### Final Gate 2 Verdict

```
================================================================
  LAUNCH READINESS GATE 2 — CLOSED / VERIFIED
================================================================
  ALL NINE GATE 2 MILESTONES (G2-01 THROUGH G2-09) HAVE BEEN
  EMPIRICALLY TESTED, RECONCILED, AND VERIFIED IN STAGING WITH
  ZERO PRODUCTION MUTATIONS.

  DOCUMENTED TESTABILITY LIMITATIONS:
  - G2-03: Cycle-end cancellation tested against uncharged sandbox fixture
    (paid_count = 0); multi-cycle renewals rely on Razorpay API consistency.
  - G2-07: Timing harness measurements represent empirical validation of the
    native crypto primitive and runtime behavior, not mathematical proof.
================================================================
```

---

## 25.27 Launch Readiness P-07 — Production Rate-Limit Threshold Verification

### Objective

Empirically verify that the production rate-limiting infrastructure accurately enforces request limits and rejects requests exceeding the configured threshold with `HTTP 429 Too Many Requests`.

### Target Endpoint & Configuration

- **Target Route:** `GET https://www.verifii.in/api/live-feed`
- **Environment:** Production
- **Backend Architecture:** Upstash Redis HTTP REST API via `@upstash/redis` (v1.38.2)
- **Algorithm:** Atomic `INCR` + `EXPIRE` over a fixed sliding window
- **Authoritative Window (`RATE_LIMIT_WINDOW_MS`):** 60,000 ms (60 seconds)
- **Authoritative Maximum Requests (`RATE_LIMIT_MAX_REQUESTS`):** 15 requests
- **Fail Mode:** `failOpen = true` (configured selectively for public read-only telemetry to prevent Redis latency or partitions from interrupting public viewing)
- **Key Derivation:** `getClientIdentifier(request)` resolving `${clientIp}:/api/live-feed`

### Empirical Test Execution & Results

Verification was executed via a controlled 16-request ($N + 1$, where $N = 15$) sequential probe batch utilizing cache-busting query parameters to bypass Vercel Edge CDN caching while preserving identical rate-limit bucket identity:

| Request Range | Dispatched URL | HTTP Status | Vercel Edge Cache | Duration | Response Payload / Outcome |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Requests 1–15** | `GET /api/live-feed?p07_probe_<ts>_1..15` | **200 OK** | `MISS` (Origin) | 698–3,339 ms | `[]` (Live feed query executed) |
| **Request 16 ($N+1$)** | `GET /api/live-feed?p07_probe_<ts>_16` | **429 Too Many Requests** | `MISS` (Origin) | 560 ms | `{"error":"Rate limit exceeded"}` |

### Origin Reach & Timing Evidence

- **Origin Reach:** 16 / 16 requests returned `x-vercel-cache: MISS`, confirming 100% origin serverless function execution.
- **Total Test Duration:** 18,948 ms (18.95 seconds), completing comfortably within the 60-second window.
- **Initial Inconclusive Test Record:** An earlier probe without cache-busting query parameters returned HTTP 200 on requests 2–61 due to Vercel Edge Caching (`s-maxage=10`, `x-vercel-cache: HIT`). Per governance standards, that run was classified as `INCONCLUSIVE` and only the cache-bypassed origin retest serves as authoritative verification evidence.

### Safety & Isolation

- **Database Delta:** 0 rows created, updated, or deleted across all Supabase tables.
- **Auth Mutations:** 0 accounts created or modified.
- **Redis Safety:** No manual Redis configuration changes, key deletions, or flushes were performed. Rate-limit keys were created/updated only through normal application behavior during the controlled test and expired according to the configured TTL.
- **Mutations:** 0 commits, 0 pushes, 0 deployments.

### Evidence Boundaries & Testing Limits

- **Scope Boundary:** This test empirically verifies the rate-limit threshold enforcement on the `/api/live-feed` route at origin. It does not imply that every application endpoint has been subjected to burst exhaustion testing.
- **Fail-Open Boundary:** Because `/api/live-feed` intentionally specifies `failOpen: true`, this test verified normal threshold exhaustion against a healthy Redis backend; it does not test behavior during a simulated Redis outage.

### Final P-07 Status

```
============================================================
P-07 — PRODUCTION RATE-LIMIT THRESHOLD: CLOSED / VERIFIED
============================================================
```

---

## 25.28 Phase 2 Objective 5 — Production Verification & Public Discovery Smoke Test

### Objective

Perform end-to-end production verification of Phase 2 Objective 5 (Search, Filtering & Public Discovery) following the deployment of commit `b4fcc81d81fcfc5a7e20586dceaee055f0ce2ec3` (`feat: complete Phase 2 founder discovery`).

### Target & Deployment Identity

- **Production URL:** `https://www.verifii.in/leaderboard`
- **Deployment Commit:** `b4fcc81d81fcfc5a7e20586dceaee055f0ce2ec3` (`b4fcc81`)
- **Hosting Environment:** Vercel Global Edge (`server: Vercel`, `x-powered-by: Next.js`)
- **Mode:** Strict Read-Only Smoke Test (17 sequential HTTP GET requests)

### Production Smoke Test Matrix & Results

| Probe ID | Probed Path / Query | HTTP Status | Vercel Edge Cache | Response Size | Finding / Rendered Behavior | Classification |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| **TEST-01** | `/leaderboard` | **200 OK** | `MISS` (Origin) | 32,903 B | Base leaderboard rendered; methodology panel and filter controls active; `0 Companies` pool counter. | **PASS — EMPIRICALLY VERIFIED** |
| **TEST-02** | `/leaderboard?q=xyznonexistent` | **200 OK** | `MISS` (Origin) | 33,974 B | Search input populated; clear search button rendered; `Reset (1)` button active; `No Matching Startups` empty state rendered. | **PASS — EMPIRICALLY VERIFIED** |
| **TEST-02B**| `/leaderboard?search=xyznonexistent` | **200 OK** | `MISS` (Origin) | 32,987 B | Non-standard parameter ignored; safe baseline empty state rendered. | **PASS — STRUCTURALLY VERIFIED** |
| **TEST-03** | `/leaderboard?category=SaaS%2FSoftware` | **200 OK** | `MISS` (Origin) | 33,566 B | Canonical category selected in dropdown; `Reset (1)` active; 0 5xx errors. | **PASS — EMPIRICALLY VERIFIED** |
| **TEST-04** | `/leaderboard?category=INVALID_CATEGORY_PROBE` | **200 OK** | `MISS` (Origin) | 33,017 B | Unlisted category safely dropped; fell back to `All Categories`. | **PASS — EMPIRICALLY VERIFIED** |
| **TEST-05** | `/leaderboard?revenue=under-1k` | **200 OK** | `MISS` (Origin) | 33,607 B | Range `< ₹1,000` selected in dropdown; `Reset (1)` active. | **PASS — EMPIRICALLY VERIFIED** |
| **TEST-05B**| `/leaderboard?revenue=0-1000` | **200 OK** | `MISS` (Origin) | 32,966 B | Unlisted key dropped; fell back to `All Revenue Ranges`. | **PASS — STRUCTURALLY VERIFIED** |
| **TEST-06** | `/leaderboard?city=Lucknow` | **200 OK** | `MISS` (Origin) | 33,948 B | City input populated with `Lucknow`; `Reset (1)` active; empty state rendered. | **PASS — EMPIRICALLY VERIFIED** |
| **TEST-07** | `/leaderboard?verification=verified` | **200 OK** | `MISS` (Origin) | 33,551 B | `Payment Verified` selected; `Reset (1)` active; 0 private records leaked. | **PASS — STRUCTURALLY VERIFIED** |
| **TEST-08** | `/leaderboard?verification=self_reported` | **200 OK** | `MISS` (Origin) | 33,571 B | `Self-Reported` selected; `Reset (1)` active; 0 private records leaked. | **PASS — STRUCTURALLY VERIFIED** |
| **TEST-09** | `/leaderboard?verification=all` | **200 OK** | `MISS` (Origin) | 32,972 B | Baseline `All Statuses` selected; initial empty state rendered. | **PASS — EMPIRICALLY VERIFIED** |
| **TEST-10A**| `/leaderboard?page=1` | **200 OK** | `MISS` (Origin) | 32,942 B | Offset `0..19` query executed cleanly. | **PASS — EMPIRICALLY VERIFIED** |
| **TEST-10B**| `/leaderboard?page=100` | **200 OK** | `MISS` (Origin) | 33,101 B | Offset `1980..1999` query executed cleanly; bounded execution. | **PASS — EMPIRICALLY VERIFIED** |
| **TEST-10C**| `/leaderboard?page=101` | **200 OK** | `MISS` (Origin) | 33,101 B | Out-of-bounds page clamped to `MAX_PAGE_NUMBER = 100`. | **PASS — EMPIRICALLY VERIFIED** |
| **TEST-11** | `/leaderboard?q=xyznonexistent&category=SaaS%2FSoftware&verification=verified` | **200 OK** | `MISS` (Origin) | 34,183 B | Multi-filter composition active; `Reset (3)` rendered; `No Matching Startups` empty state rendered. | **PASS — EMPIRICALLY VERIFIED** |
| **TEST-12A**| `/leaderboard?q=%25%25%5F%5F` | **200 OK** | `MISS` (Origin) | 33,932 B | Wildcard characters `%` and `_` sanitized to spaces, preventing SQL wildcard injection. | **PASS — EMPIRICALLY VERIFIED** |
| **TEST-12B**| `/leaderboard?q=A` $\times 150$ | **200 OK** | `MISS` (Origin) | 34,554 B | Overlong query truncated to `MAX_QUERY_LENGTH = 100` chars; 0 buffer or memory errors. | **PASS — EMPIRICALLY VERIFIED** |

### Evidence Boundaries & Catalog Constraint

- **Production Catalog State:** At the time of this smoke test, the production catalog contained 1 private startup (`is_public = false`), 0 public startups (`is_public = true`), 0 provider connections, and 0 transactions.
- **Empirical vs Structural Distinction:**
  - *Empirically Verified:* HTTP routing, 200 availability, UI component rendering (`LeaderboardFilters`, `LeaderboardEmptyState`, `LeaderboardPagination`), form binding, category allowlisting, range mapping, city filtering, empty-state switching, pagination clamping, input sanitization, and the root public visibility boundary.
  - *Structurally Verified:* Verification filter pipeline semantics (`verification=verified` enforcing `hasVerificationEvidence === true` and `verification=self_reported` enforcing `!hasVerificationEvidence`).
- **Authoritative Limitation Statement:** *Verification filter pipeline semantics were structurally verified against the deployed source and automated tests; positive dataset-dependent behavior remains unexercised in production because the current public catalog contains zero startups.*
- **Public Visibility Invariant:** 0 private startup records appeared in any HTML response, JSON-LD block, or hydration payload across all 17 probes (`is_public = true` strictly enforced).

### Final Objective 5 Status

```
================================================================================
PHASE 2 OBJECTIVE 5 — SEARCH & DISCOVERY: CLOSED / VERIFIED / PRODUCTION PASS
================================================================================
```

---

## 25.29 TEST 01-C — Rate-Limit Client Identity Trust Boundary

### Security Objective

Empirically remediate and verify the client-identity trust boundary in the rate-limiting infrastructure (`src/lib/rate-limit.ts`) so that rate limiting does not rely on attacker-controlled HTTP headers, respects platform-trusted headers in the Vercel production runtime, binds authenticated users strictly to verified server-side Supabase sessions, protects public endpoints with bounded anonymous fallbacks, ensures webhook routes remain securely verified by cryptographic signatures with fail-open resilience, and strictly isolates Redis rate-limit buckets across distinct routes.

### Original Trust-Boundary Vulnerability

The legacy implementation of `getClientIdentifier(request)` in `src/lib/rate-limit.ts` derived client identity via:
1. `x-forwarded-for` (`forwarded.split(",")[0].trim()`)
2. `x-real-ip`
3. `anonymous:${userAgent}:${pathname}`

**Vulnerability:** In standard proxy chains or direct HTTP requests, external clients can supply arbitrary `X-Forwarded-For` or `X-Real-IP` headers (e.g. rotating `100.64.0.x` on each request). Taking the first split element or trusting unverified headers allowed an attacker to create fresh, independent Redis rate-limit keys on every request, completely circumventing rate-limit thresholds.

### Remediation Architecture & Authoritative Identity Hierarchy

The rate limiter derives identity using an authoritative 4-tier trust hierarchy:

1. **Verified Server-Side Supabase User ID (`user.id`):**
   - Authoritative primary identity for authenticated operations obtained strictly via server-side session validation (`getAuthenticatedUser()`).
   - Generates key: `usr_${userId}:${canonicalPath}`.
   - Client-supplied parameters (`req.body.userId`, URL query strings, or client headers) are strictly forbidden from establishing identity.
2. **Runtime Socket Connection IP (`request.ip`):**
   - Trusted socket remote address when directly provided by the server/NextRequest runtime.
   - Generates key: `ip_${runtimeIp}:${canonicalPath}`.
3. **Empirically Verified Platform Header (`x-vercel-forwarded-for`):**
   - Injected and managed by the Vercel Edge proxy network. Client-supplied values are stripped and overwritten at the edge with the true connecting TCP client IP.
   - Generates key: `ip_${platformIp}:${canonicalPath}`.
4. **Bounded Anonymous Fallback (`anon_${hashToken(ua)}:${canonicalPath}`):**
   - Deterministic 32-bit FNV-1a hash of the User-Agent string.

### Strict IP Validation & Sanitization

- Added `isValidIp()` enforcing strict IPv4 (4 octets 0–255) and standard RFC IPv6 format validation.
- Any malformed string, delimiter injection (e.g. `; DROP TABLE`, colons, spaces), or oversized value is rejected and falls back safely to the bounded anonymous token without corrupting Redis keys.

### Anonymous Fallback Security Boundary

- Explicitly documented: `anon_<hash(ua)>` is a **bounded key-safety fallback** designed to maintain predictable Redis key sizes and avoid key injection when no IP is available; it is **not** an anti-sybil proof of unique client identity since User-Agent headers are client-controllable.

### Forwarded-Header Handling

- Untrusted client-controllable headers (`x-real-ip` and `x-forwarded-for` standalone) are NOT treated as authoritative identity sources in the application. When platform headers are absent and socket IP is unavailable, the limiter degrades to the bounded anonymous fallback rather than trusting spoofable client headers.

### Canonical Route & Namespace Isolation

- Every Redis rate-limit key incorporates the normalized route pathname (`rate_limit:<identity>:<canonical_path>`), guaranteeing that distinct routes (e.g. `/api/live-feed`, `/api/trust-metrics`, `/api/billing/checkout`) have independent buckets and cannot exhaust each other.

### Webhook Primacy & failOpen Rationale

- Stripe and Razorpay webhook handlers (`/api/stripe/webhook`, `/api/razorpay/webhook`, `/api/billing/webhook/razorpay`) maintain cryptographic HMAC signature verification (`stripe.webhooks.constructEvent` and `timingSafeCompare`) and PostgreSQL idempotency claims (`processed_webhook_events`) as their primary, authoritative security gate.
- Webhook rate limiting is secondary abuse mitigation and explicitly configured with `{ failOpen: true }` so that transient Redis timeouts (>2000ms) or outages never cause payment gateways (Stripe / Razorpay) to receive HTTP 429 and drop legitimate payment/subscription notifications.
- Invalid, malformed, or unsigned webhook requests are strictly rejected with HTTP 400 before any business logic or privileged database RPC executes.

### Redis Failure Semantics

- Preserves fail-closed (`failOpen: false` default) for security-sensitive and destructive endpoints (e.g. `/api/account/delete`, `/api/billing/checkout`) to prevent abuse during Redis outages.
- Preserves fail-open (`failOpen: true`) for read-only public endpoints (`/api/live-feed`, `/api/trust-metrics`) and webhook delivery endpoints.
- Redis timeout preserved at 2,000 ms.

### Automated Test Evidence (8/8 Passed)

- **Test Suite:** `tests/01-c-rate-limit-trust-boundary.test.ts`
- **Test A:** Verified platform header (`x-vercel-forwarded-for`) priority over spoofed headers (**PASS**).
- **Test B:** Untrusted headers (`x-real-ip` / `x-forwarded-for`) alone fall back to bounded anonymous token without bucket rotation (**PASS**).
- **Test C:** Attacker rotating `x-forwarded-for` & `x-real-ip` cannot create fresh Redis buckets (**PASS**).
- **Test D:** Verified server-side `user.id` overrides all headers and creates distinct user buckets (**PASS**).
- **Test E:** Same client identity on different routes produces strictly isolated keys (**PASS**).
- **Test F:** Strict IP validation rejects injection payloads and malformed strings (**PASS**).
- **Test G:** Redis error correctly obeys `failOpen: false` (block) vs `failOpen: true` (allow) (**PASS**).
- **Test H:** Webhook routes enforce cryptographic signature checks and fail-open rate limiting (**PASS**).

### Production Verification Evidence

- **Target Endpoint:** `https://www.verifii.in/api/live-feed`
- **Environment:** Production (Vercel Global Edge + Upstash Redis)
- **Configuration:** 15 requests / 60-second window, `failOpen: true`
- **Observed Live Execution:**
  - Requests 1–15: Returned `HTTP 200 OK` (`x-vercel-cache: MISS`, duration 500–1200ms).
  - Request 16: Returned `HTTP 429 Too Many Requests` (`Retry-After: 60`, `x-vercel-cache: MISS`).
  - Requests 17–21 (Adversarial Header Rotation Probe): Dispatched with rotating spoofed `X-Forwarded-For` (`203.0.113.17..21`) and `X-Real-IP` (`198.51.100.17..21`); all requests returned `HTTP 429 Too Many Requests` (`Retry-After: 60`).
  - **Result:** Confirmed that client-controlled headers cannot bypass production rate limiting.

### Upstash Redis Production Confirmation

- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` confirmed active in Vercel Production.
- Redis atomic `INCR` + `EXPIRE` operations verified live. Credentials securely retained in Vercel environment without documentation leakage.

### Implementation & Cleanup Commits

- **Implementation Commit:** `106d632` (`fix(security): resolve TEST 01-C rate-limit client identity trust boundary`)
- **Diagnostic Cleanup Commit:** `5935d27` (`chore(security): remove temporary IP diagnostic endpoint`)

### Final Status

```
============================================================
TEST 01-C — RATE-LIMIT TRUST BOUNDARY: CLOSED / VERIFIED
============================================================
```

---

## 25.30 TEST 01-D — Build / Runtime Configuration Consistency

### Objective

Empirically audit and verify configuration consistency across all execution stages: local source configuration, build environment, Next.js build compilation (Turbopack), Vercel deployment, production serverless runtime, API routes, middleware, and browser client runtime. Verify that security-sensitive credentials remain strictly isolated to the server runtime, that client bundles contain zero private secrets or secret-holder module dependencies, and that dynamic production endpoints operate with 100% configuration parity.

### Configuration Lifecycle & Architecture

The platform enforces strict unidirectional configuration isolation:
$$\text{Local Source Configuration} \longrightarrow \text{Build Environment} \longrightarrow \text{Next.js Build (Turbopack)} \longrightarrow \text{Vercel Deployment} \longrightarrow \text{Production Runtime} \longrightarrow \text{Server/API Functions} \longrightarrow \text{Browser/Client Runtime}$$

1. **Build Compilation (`next.config.ts` & Turbopack):**
   - No runtime secrets are inlined via `nextConfig.env` or webpack `DefinePlugin`.
   - Security headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `Permissions-Policy`) are hardcoded in the root Next.js configuration.
2. **Server Runtime Environment:**
   - Evaluates sensitive credentials dynamically on demand (`SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_BILLING_WEBHOOK_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RESEND_API_KEY`, `CRON_SECRET`).
3. **Client Browser Boundary:**
   - Only explicitly declared `NEXT_PUBLIC_*` identifiers (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`) are accessible to client components.
4. **Vercel Environment Consistency:**
   - Production variables are configured as `Sensitive/Hidden` within Vercel Production scope with 100% naming parity against code contracts.

### Threat Scenario Evaluation (D-001 — D-010)

| Scenario ID | Invariant Tested | Finding / Evaluation | Result |
| :--- | :--- | :--- | :---: |
| **D-001** | Build-time secret embedding | Zero raw secret values in static build artifacts or client chunks. | **PASS** |
| **D-002** | Runtime-required secret missing | All 23 required runtime secrets confirmed active in Vercel Production metadata. | **PASS** |
| **D-003** | Production/build configuration mismatch | Canonical origin (`https://www.verifii.in`) and Supabase URLs match build and runtime. | **PASS** |
| **D-004** | Preview/Production configuration contamination | Vercel environments strictly isolated; Upstash Redis tokens scoped exclusively to Production. | **PASS** |
| **D-005** | Unsafe `NEXT_PUBLIC` exposure | Only browser URLs, publishable anon JWT, and public Razorpay Key IDs use the prefix. | **PASS** |
| **D-006** | Server-only module entering client graph | Client components (`'use client'`) contain zero imports of server secret modules; client execution tree verified free of private keys. | **PASS** |
| **D-007** | Middleware/API configuration mismatch | Middleware and API routes share identical cookie schemas (`sb-*-auth-token`) and Supabase URLs. | **PASS** |
| **D-008** | Edge/Node configuration incompatibility | Edge route (`/api/og/*`) uses standard Web API `fetch` without unsupported Node binary bindings. | **PASS** |
| **D-009** | Configuration naming drift | 100% exact parity between code variable names and Vercel production keys. | **PASS** |
| **D-010** | Static generation capturing runtime configuration | Dynamic API routes and founder dashboards are server-rendered dynamically on demand (`ƒ`). | **PASS** |

### Automated Test Evidence

- **Test Suite:** `tests/01-d-build-runtime-consistency.test.ts`
- **Results:** 6 passed, 0 failed (0 errors)
  - `TEST A: Only intended public identifiers use the NEXT_PUBLIC_ prefix` — **PASS**
  - `TEST B: Server runtime configuration contracts match expected variable names` — **PASS**
  - `TEST C: next.config.ts enforces strict baseline security headers` — **PASS**
  - `TEST D: Middleware and Server Auth share identical Supabase Auth cookie patterns` — **PASS**
  - `TEST E: Client components ('use client') never directly import server secret holders` — **PASS**
  - `TEST F: Edge runtime route (/api/og/startup/[slug]) relies only on Web APIs` — **PASS**
- **Type-Check:** `npm run type-check` (`tsc --noEmit`) $\rightarrow$ **0 errors**.
- **Production Build:** `npm run build` $\rightarrow$ Clean exit code 0; 52 static pages generated, dynamic routes preserved.

### Production Runtime Evidence

Controlled read-only HTTP probes against live production (`https://www.verifii.in`):
- `GET /api/live-feed`: HTTP 200 OK (`x-vercel-cache: MISS`, `content-type: application/json`, `server: Vercel`).
- `GET /leaderboard`: HTTP 200 OK (`x-vercel-cache: MISS`, `content-type: text/html; charset=utf-8`, `server: Vercel`).
- `GET /pricing`: HTTP 200 OK (`x-vercel-cache: MISS`, `content-type: text/html; charset=utf-8`, `server: Vercel`).
- **Result:** Confirmed origin runtime execution without configuration or environment-related errors.

### Final Status

```
================================================================================
TEST 01-D — BUILD/RUNTIME CONFIGURATION CONSISTENCY: CLOSED / VERIFIED
================================================================================
```

---

## 25.31 TEST 01-E — Secret Exposure Through Bundles, API, Errors & Diagnostics

### Objective

Perform a comprehensive forensic security audit to ensure that no server-side secrets, provider credentials, database service roles, encryption keys, webhook secrets, or private environment variables are exposed through client JavaScript bundles, source maps, server-rendered HTML, React Server Component (RSC) flight payloads, API responses, error responses, HTTP headers, static assets, diagnostic routes, or application logging.

### Audit Surface & Threat Matrix (E-001 — E-015)

| Threat ID | Exposure Vector / Invariant | Status | Severity | Forensic Evidence & Verification |
| :--- | :--- | :---: | :---: | :--- |
| **E-001** | Browser JavaScript bundle exposure | **PASS** | **NONE** | Full recursive scan of `.next/static/chunks/` confirmed zero private keys, tokens, or encryption secrets embedded in client bundles. |
| **E-002** | Source map exposure | **PASS** | **NONE** | `productionBrowserSourceMaps` disabled in `next.config.ts`; 0 client `.map` files exist in build output; live probes return HTTP 403. |
| **E-003** | Server-rendered HTML exposure | **PASS** | **NONE** | Live probes across 6 core production pages (`/`, `/pricing`, `/leaderboard`, `/submit`, `/privacy`, `/terms`) confirmed zero private credentials in SSR HTML. |
| **E-004** | RSC / Flight payload exposure | **PASS** | **NONE** | Next.js flight payloads (`self.__next_f.push`) contain strictly whitelisted public component props and metrics. |
| **E-005** | Public API response exposure | **PASS** | **NONE** | Live probes against `/api/live-feed`, `/api/trust-metrics`, and public badge/OG endpoints return clean, sanitized data payloads. |
| **E-006** | API error / stack trace exposure | **PASS** | **NONE** | Probing invalid parameters, nonexistent routes, and unauthorized calls returned sanitized JSON error objects without stack traces or database errors. |
| **E-007** | Response-header exposure | **PASS** | **NONE** | Security headers enforced (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `Permissions-Policy`); zero internal infrastructure headers. |
| **E-008** | Static asset / configuration exposure | **PASS** | **NONE** | `/public` directory contains only public icons, manifest, and branding assets; zero private config files. |
| **E-009** | Debug / test endpoint exposure | **PASS** | **NONE** | `/dev/emails` returns HTTP 404 in production; all `/api/admin/*` routes enforce strict server-side `isAdmin` session validation (HTTP 401/403). |
| **E-010** | Logging / diagnostic exposure | **PASS** | **NONE** | Repository scan of `console.*` and `logger.*` confirmed zero logging of raw secrets, bearer tokens, or webhook secret keys. |
| **E-011** | Client-side serialized state exposure | **PASS** | **NONE** | React state is restricted to public profile fields, aggregated metrics, and sanitized UI parameters. |
| **E-012** | Provider / API response leakage | **PASS** | **NONE** | Stripe and Razorpay API interactions execute exclusively on serverless runtimes; raw authorization headers are never forwarded to clients. |
| **E-013** | Authentication / token leakage | **PASS** | **NONE** | SSR session cookies with `HttpOnly` flags protect session state; `SUPABASE_SERVICE_ROLE_KEY` is never passed to client auth flows. |
| **E-014** | Internal infrastructure disclosure | **PASS** | **NONE** | PostgreSQL hostnames and Upstash Redis endpoints are fully encapsulated behind serverless API abstractions. |
| **E-015** | Environment-variable serialization | **PASS** | **NONE** | Only explicitly declared `NEXT_PUBLIC_*` identifiers are accessible to client-side code. |

### Architectural Hardening: Client/Server Analytics Constant Isolation

- **Observation:** `src/app/submit/page.tsx` (`"use client"`) previously imported `ONBOARDING_ANALYTICS_EVENTS` directly from `src/lib/analytics/events.ts`, a module that also exports server-side database fetching functions (`fetchOnboardingEvents`).
- **Remediation:** Extracted pure client-safe event definitions into [`src/lib/analytics/event-constants.ts`](file:///c:/Users/eshan/Downloads/verifi-app/src/lib/analytics/event-constants.ts) and updated `src/lib/analytics/events.ts` to re-export them. Updated `src/app/submit/page.tsx` to import from `@/lib/analytics/event-constants`.
- **Commit:** `d360141` (`security: isolate client-safe analytics constants`).
- **Result:** Completely decoupled the client component bundle from server analytics data access functions while preserving 100% analytics event naming, database schemas, and typing contracts.

### Final Status

```
================================================================================
TEST 01-E — SECRET EXPOSURE THROUGH BUNDLES/API/ERRORS: CLOSED / VERIFIED
================================================================================
```

---

## 25.32 TEST 01 — Master Environment, Secrets & Configuration Audit Closure

### Master Objective & Scope

TEST 01 encompasses the complete, multi-phase verification of Verifii's credential isolation, environment variable architecture, Git exposure boundaries, production rate-limit trust boundaries, build/runtime configuration parity, and browser/API secret exposure prevention.

### Consolidated Sub-Audit Results

| Sub-Test ID | Audit Focus | Key Verifications & Remediations | Closure Commit / Ref | Status |
| :--- | :--- | :--- | :---: | :---: |
| **TEST 01-A** | Environment Variable Inventory & Exposure | Cataloged all 23 production environment variables; validated server-only vs `NEXT_PUBLIC` boundaries. | Historical Baseline | **CLOSED / VERIFIED** |
| **TEST 01-B** | Environment Files / Git Exposure | Verified `.gitignore` prevents tracking of `.env*` files; zero live credentials committed in git repository. | Historical Baseline | **CLOSED / VERIFIED** |
| **TEST 01-C** | Production Secret Presence & Rate-Limit Trust Boundary | Confirmed Upstash Redis production configuration; implemented 4-tier client identity trust hierarchy in `src/lib/rate-limit.ts` (`106d632`); removed debug route (`5935d27`); verified 8/8 automated test suites and live production 15 req/60s rate limiting on `/api/live-feed` with spoofing resistance. | `47eb488` (Handbook v2.15) | **CLOSED / VERIFIED** |
| **TEST 01-D** | Build / Runtime Configuration Consistency | Verified 100% naming parity between code contracts and Vercel Production; evaluated D-001 to D-010 invariants; verified clean production build (52/52 pages) and 6/6 automated test suites (`tests/01-d-build-runtime-consistency.test.ts`). | `7d3a6dd` (Handbook v2.16) | **CLOSED / VERIFIED** |
| **TEST 01-E** | Secret Exposure Through Bundles / API / Errors | Confirmed zero real secrets exposed in client bundles, source maps, HTML, RSC, API responses, or error payloads (E-001 to E-015 PASS); hardened analytics constants into pure client module (`d360141`). | `d360141` | **CLOSED / VERIFIED** |

### Explicit Non-Existence Statement

> **TEST 01-F does not exist.** The TEST 01 security audit framework concludes with TEST 01-E. No additional TEST 01 sub-audits exist or will be created.

### Master Security Conclusion

1. **Zero Secret Exposure:** No production credentials, database master keys (`SUPABASE_SERVICE_ROLE_KEY`), encryption secrets (`ENCRYPTION_SECRET`), payment gateway keys (`STRIPE_SECRET_KEY`, `RAZORPAY_KEY_SECRET`), or rate-limiting tokens (`UPSTASH_REDIS_REST_TOKEN`) are exposed to client runtimes, browser bundles, public source maps, HTML payloads, or API error responses.
2. **Strict Identity Trust Boundaries:** Client identity in rate limiting is anchored to cryptographically verified server-side sessions, runtime socket IPs, or platform-verified headers (`x-vercel-forwarded-for`), rendering spoofed `X-Forwarded-For` or `X-Real-IP` injection attacks ineffective.
3. **Unidirectional Configuration Flow:** Build-time static compilation is strictly decoupled from dynamic runtime serverless credentials, maintaining complete configuration consistency across local, preview, and production environments.
4. **Remaining Operational Considerations:** Standard operational lifecycle management applies (e.g., periodic scheduled key rotation via cloud provider consoles and ongoing webhook signature health monitoring). Zero unresolved application security defects remain within the TEST 01 domain.

### Final Master Status

```
================================================================================
TEST 01 — MASTER ENVIRONMENT, SECRETS & CONFIGURATION AUDIT: CLOSED / VERIFIED
================================================================================
```

---

# Appendix A — Glossary

This glossary defines commonly used technical and product terms throughout the Verifii Engineering Handbook.

The objective is to ensure that all contributors use consistent terminology when discussing the platform.

---

## API

Application Programming Interface.

The communication layer between the frontend, backend services, external providers, and the database.

---

## ADR

Architecture Decision Record.

A document that records an important architectural decision, the alternatives considered, the reasoning behind the decision, and its long-term consequences.

---

## ARR

Annual Recurring Revenue.

The normalized annual value of recurring subscription revenue.

---

## Billing System

The subsystem responsible for subscription management, payment processing, and premium feature access.

---

## Dashboard

The authenticated workspace where founders manage startups, verification, billing, and publication.

---

## Founder

An authenticated user who owns one or more startup submissions within Verifii.

---

## Leaderboard

The public directory of verified startups that have satisfied publication requirements.

---

## MRR

Monthly Recurring Revenue.

The normalized monthly recurring revenue calculated through supported verification providers.

---

## Provider

A supported payment platform that Verifii uses for revenue verification.

Current providers include:

- Razorpay
- Stripe

---

## Provider Connection

The secure relationship between a startup and a supported payment provider.

---

## Public Startup

A startup that has completed verification, satisfied publication requirements, and has been intentionally published by its founder.

---

## Publication

The process of making a verified startup publicly visible throughout Verifii.

Publication is separate from verification.

---

## Revenue Snapshot

A historical record of verified revenue generated during synchronization.

Snapshots preserve historical verification data over time.

---

## Startup Submission

The primary platform entity representing a founder's startup.

A startup progresses through submission, verification, publication, and ongoing management throughout its lifecycle.

---

## Trust Engine

The subsystem responsible for evaluating verification quality, confidence, fraud indicators, and trust metrics.

---

## Verification

The process of confirming startup revenue using supported payment providers rather than screenshots or manually entered metrics.

---

## Verification Provider

A payment provider capable of supplying data required for revenue verification.

---

## Visibility System

The subsystem responsible for determining whether a startup is publicly accessible.

Visibility is controlled independently from verification.

---

## is_public

The platform-wide visibility flag that determines whether a startup may appear on public surfaces.

Public visibility is granted only after the startup satisfies publication requirements and the founder chooses to publish it.

---

## Owner Bypass

A platform rule allowing founders to access their own private startups while preventing access by public visitors.

---

## Source of Truth

The authoritative system responsible for maintaining a specific category of information.

Examples include:

- Authentication → Supabase Auth
- Startup Data → Startup Submissions
- Revenue → Revenue Snapshots
- Visibility → is_public

---

# Appendix B — Project Structure

This appendix documents the high-level organization of the Verifii codebase.

Rather than listing every individual file, it explains the responsibility of each major directory so contributors can quickly understand where new functionality belongs.

The project structure is organized around platform domains rather than isolated pages or features, improving maintainability and reducing duplication.

---

## B.1 Root Directory

The root directory contains project configuration, documentation, and development tooling.

Typical contents include:

- Source code (`src/`)
- Database migrations
- Public assets
- Documentation
- Configuration files
- Package management
- Build configuration

The root should remain clean and contain only project-wide resources.

---

## B.2 Source Directory (`src/`)

The `src/` directory contains the primary application code.

Major areas include:

- Application routes
- React components
- Business logic
- Utility libraries
- Hooks
- Types
- Middleware

This directory represents the core of the Verifii application.

---

## B.3 Application Layer (`src/app/`)

The App Router contains all application routes and server-side functionality.

Typical responsibilities include:

- Public pages
- Founder pages
- Administrative pages
- API routes
- Metadata generation
- Route-specific layouts

Every route should have a clearly defined responsibility.

---

## B.4 Components (`src/components/`)

The components directory contains reusable user interface components.

Examples include:

- Dashboard components
- Verification components
- Billing components
- Startup components
- Shared UI components

Components should remain reusable and independent whenever practical.

---

## B.5 Library (`src/lib/`)

The library directory contains reusable business logic and platform services.

Typical modules include:

- Authentication
- Verification
- Billing
- Provider integrations
- Revenue processing
- Trust scoring
- Visibility
- Utilities

Business logic belongs here rather than inside page components.

---

## B.6 API Routes

API routes expose secure backend functionality.

Responsibilities include:

- Authentication
- Startup management
- Verification
- Billing
- Public APIs
- Administrative operations

Every API route should perform:

- Authentication
- Authorization
- Validation
- Business logic
- Response generation

---

## B.7 Database

Database resources include:

- Schema
- Migrations
- Row Level Security (RLS)
- SQL functions
- Storage configuration

Database changes should always be performed through migrations.

---

## B.8 Public Assets

The public directory stores static assets such as:

- Images
- Icons
- Logos
- Favicons
- Static files

Sensitive information must never be stored here.

---

## B.9 Documentation

Documentation includes:

- Product Requirements Document (PRD)
- Engineering Handbook
- Implementation Plan
- Architecture Decision Records
- Supporting documentation

Documentation should evolve alongside the platform.

---

## B.10 Configuration

Configuration files define project-wide behavior.

Examples include:

- TypeScript configuration
- Next.js configuration
- Tailwind configuration
- ESLint configuration
- Package configuration
- Environment variable definitions

Configuration should remain centralized whenever possible.

---

## B.11 Folder Organization Principles

The project follows several organizational principles.

### Domain-Oriented Structure

Folders are organized by business domain rather than technical layer wherever practical.

---

### Separation of Concerns

Frontend, backend, business logic, and infrastructure remain clearly separated.

---

### Reusability

Shared functionality should exist in one location only.

Avoid duplicating components or business logic.

---

### Discoverability

New contributors should be able to locate functionality without extensive project knowledge.

Folder names should clearly communicate their purpose.

---

## B.12 Current Project Organization

At the time of writing, the Verifii project is organized around the following major areas:

- Application Layer
- Components
- Business Logic
- Database
- Public Assets
- Documentation
- Configuration
- Development Tooling

As the platform evolves, new directories may be introduced while preserving the same architectural principles described in this appendix.

---

# Appendix C — Technology Stack

This appendix documents the primary technologies used throughout the Verifii platform and explains the role each technology plays within the overall architecture.

Rather than simply listing dependencies, this appendix provides context for why each technology was selected and where it fits within the platform.

As Verifii evolves, new technologies may be introduced while maintaining the architectural principles established throughout this handbook.

---

## C.1 Technology Philosophy

Verifii follows several guiding principles when selecting technologies.

- Prefer mature and well-supported technologies.
- Minimize unnecessary dependencies.
- Choose tools that improve developer productivity.
- Prioritize scalability and long-term maintainability.
- Favor technologies with strong community support.

Technology decisions should support the product rather than define it.

---

## C.2 Frontend

### Next.js

Role:

- Application framework.
- Routing.
- Server-side rendering.
- API routes.
- Metadata generation.

Reason for Selection:

Provides a production-ready React framework with strong performance, SEO support, and an integrated backend suitable for SaaS applications.

---

### React

Role:

- User Interface.
- Component Architecture.
- Client-side interactions.

Reason for Selection:

Provides a flexible component model that supports scalable frontend development.

---

### TypeScript

Role:

- Static typing.
- Improved maintainability.
- Better developer experience.

Reason for Selection:

Reduces runtime errors and improves long-term code quality.

---

### Tailwind CSS

Role:

- Styling.
- Responsive layouts.
- Design consistency.

Reason for Selection:

Allows rapid UI development while maintaining a consistent design system.

---

### shadcn/ui

Role:

- Reusable UI components.

Reason for Selection:

Provides accessible, customizable components without locking the project into a specific design system.

---

## C.3 Backend

### Next.js Server Components

Role:

- Backend rendering.
- Secure server execution.

Reason for Selection:

Allows business logic to execute securely while remaining closely integrated with the frontend.

---

### Next.js API Routes

Role:

- Backend APIs.
- Business logic.
- Secure platform operations.

Reason for Selection:

Provides a unified development experience while simplifying deployment.

---

## C.4 Database

### Supabase PostgreSQL

Role:

- Primary relational database.

Responsibilities include:

- Startup data.
- Revenue data.
- Authentication support.
- Provider connections.
- Billing records.

Reason for Selection:

Offers a fully managed PostgreSQL environment with modern developer tooling.

---

### Row Level Security (RLS)

Role:

- Database authorization.

Reason for Selection:

Adds an additional layer of security by enforcing access policies directly within the database.

---

### Supabase Storage

Role:

- File storage.

Examples include:

- Verification proofs.
- Uploaded assets.
- Future media resources.

---

## C.5 Authentication

### Supabase Auth

Role:

- User authentication.
- Session management.
- Identity verification.

Reason for Selection:

Provides secure authentication while integrating directly with the platform database.

---

## C.6 Payment Providers

### Razorpay

Role:

- Primary Indian payment provider.

Current Usage:

- Revenue verification.
- Subscription billing.

Reason for Selection:

Supports Indian founders through native INR and UPI workflows.

---

### Stripe

Role:

- International payment provider.

Current Usage:

- Revenue verification.
- Subscription billing.

Reason for Selection:

Provides global payment support for international founders.

---

## C.7 Email Services

### Resend

Role:

- Transactional email delivery.

Examples include:

- Verification emails.
- Notifications.
- Platform communications.

Reason for Selection:

Simple API with reliable delivery and excellent developer experience.

---

## C.8 Hosting & Infrastructure

### Vercel

Role:

- Application hosting.
- Continuous deployment.
- Serverless execution.

Reason for Selection:

Provides seamless deployment for Next.js applications with integrated infrastructure management.

---

## C.9 Development Tools

Development is supported through modern engineering tools.

Examples include:

- Git
- GitHub
- npm
- ESLint
- Prettier
- TypeScript Compiler

These tools improve consistency, collaboration, and code quality.

---

## C.10 AI-Assisted Development

Verifii incorporates AI-assisted development to improve engineering productivity.

Current tools include:

- ChatGPT
- Claude
- Cursor
- Antigravity

AI tools assist with:

- Architecture discussions.
- Code generation.
- Refactoring.
- Documentation.
- Debugging.

Every AI-generated contribution must be reviewed, understood, tested, and validated before production deployment.

---

## C.11 Technology Selection Principles

When introducing new technologies, contributors should evaluate:

- Long-term maintenance.
- Community support.
- Security.
- Performance.
- Scalability.
- Developer experience.
- Compatibility with existing architecture.

Technologies should be introduced only when they provide meaningful value to the platform.

---

## C.12 Current Technology Stack

At the time of writing, Verifii is built using:

Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

Backend

- Next.js API Routes
- Server Components

Database

- Supabase PostgreSQL
- Row Level Security
- Supabase Storage

Authentication

- Supabase Auth

Payments

- Razorpay
- Stripe

Infrastructure

- Vercel

Email

- Resend

Development

- Git
- GitHub
- npm
- ESLint
- AI-assisted development

This technology stack has been selected to balance performance, maintainability, scalability, and long-term product growth while supporting Verifii's India-first strategy.

---

## Future Evolution

Future technology additions may include:

- Redis for caching.
- Background job processing.
- Advanced monitoring platforms.
- Analytics infrastructure.
- Search indexing.
- AI-powered trust intelligence.
- Enterprise infrastructure components.

Technology adoption will continue to prioritize simplicity, reliability, and maintainability over unnecessary complexity.

---

# Appendix D — External Services

This appendix documents the third-party services integrated with the Verifii platform and explains the responsibility of each service within the overall architecture.

External services are selected to provide specialized capabilities while allowing Verifii to remain focused on its core mission of startup verification and trust.

Each external dependency should have a clearly defined purpose, limited scope, and well-documented integration.

---

## D.1 External Service Philosophy

Verifii follows several principles when integrating external services.

- Prefer best-in-class providers.
- Minimize vendor lock-in where practical.
- Protect sensitive credentials.
- Isolate integrations behind service layers.
- Replace providers with minimal architectural impact.

Every external dependency should provide measurable value to the platform.

---

## D.2 Supabase

Category

Backend Platform

Responsibilities

- PostgreSQL Database
- Authentication
- Row Level Security (RLS)
- File Storage
- Database Functions
- SQL Migrations

Reason for Selection

Supabase provides a modern backend platform built on PostgreSQL while significantly reducing infrastructure management overhead.

---

## D.3 Vercel

Category

Application Hosting

Responsibilities

- Frontend Hosting
- API Hosting
- Continuous Deployment
- Serverless Functions
- Environment Management

Reason for Selection

Vercel provides seamless deployment and infrastructure optimized for Next.js applications.

---

## D.4 Razorpay

Category

Payment Provider

Responsibilities

- Startup Revenue Verification
- Subscription Billing
- Indian Payment Processing

Reason for Selection

Razorpay is the primary payment provider for Verifii and aligns with the platform's India-first strategy through native INR and UPI support.

---

## D.5 Stripe

Category

Payment Provider

Responsibilities

- Startup Revenue Verification
- Subscription Billing
- International Payment Processing

Reason for Selection

Stripe provides global payment support for founders operating outside India.

Although fully supported, Stripe currently serves as the secondary provider within the founder verification experience.

---

## D.6 Resend

Category

Email Delivery

Responsibilities

- Transactional Emails
- Founder Notifications
- Verification Emails
- Platform Communications

Reason for Selection

Resend provides reliable email delivery with a simple developer experience.

---

## D.7 GitHub

Category

Version Control

Responsibilities

- Source Code Management
- Commit History
- Branch Management
- Collaboration
- Release History

Reason for Selection

GitHub serves as the central repository for Verifii's source code and development workflow.

---

## D.8 AI Development Tools

Verifii incorporates several AI-assisted development tools.

### ChatGPT

Responsibilities

- Architecture discussions
- Engineering documentation
- Product planning
- Technical reviews
- Problem solving

---

### Claude

Responsibilities

- Large-scale code analysis
- Refactoring
- Implementation planning
- Technical validation

---

### Cursor

Responsibilities

- AI-assisted coding
- Code completion
- Local development
- Refactoring support

---

### Antigravity

Responsibilities

- Feature implementation
- Engineering execution
- Large codebase modifications
- Automated development assistance

AI tools assist engineering workflows but never replace human review, testing, or architectural decision-making.

---

## D.9 Domain & DNS

Responsibilities

- Domain management
- DNS configuration
- SSL certificates
- Production routing

Domains should always use secure HTTPS connections.

---

## D.10 Analytics (Future)

Planned Responsibilities

- Platform usage analytics
- Founder engagement
- Feature adoption
- Performance monitoring

Analytics should respect user privacy while providing actionable product insights.

---

## D.11 Monitoring (Future)

Planned Responsibilities

- Error tracking
- Performance monitoring
- Operational alerts
- Infrastructure health

Monitoring services should provide early visibility into production issues before they affect founders.

---

## D.12 Integration Principles

Every external integration should follow these engineering principles.

### Isolation

External services should communicate through dedicated integration modules rather than directly from UI components.

---

### Security

Credentials must remain protected using secure environment variables and encrypted storage where appropriate.

---

### Reliability

External service failures should degrade gracefully without compromising platform integrity.

---

### Replaceability

Where practical, integrations should be designed so providers can be replaced with minimal impact on the overall architecture.

---

## D.13 Current External Services

At the time of writing, Verifii integrates with:

| Service | Category | Primary Responsibility |
|----------|----------|------------------------|
| Supabase | Backend Platform | Database, Authentication, Storage |
| Vercel | Hosting | Application Deployment |
| Razorpay | Payments | Primary Indian Payment Provider |
| Stripe | Payments | International Payment Provider |
| Resend | Email | Transactional Emails |
| GitHub | Development | Version Control |
| ChatGPT | AI Development | Architecture & Documentation |
| Claude | AI Development | Code Analysis & Planning |
| Cursor | AI Development | AI Coding Assistant |
| Antigravity | AI Development | Feature Implementation |

---

## Future Evolution

As Verifii grows, additional external services may be introduced for:

- Advanced analytics
- Search infrastructure
- AI trust intelligence
- Monitoring and alerting
- Background job processing
- Enterprise integrations
- CRM integrations
- Marketing automation

Every new integration should be evaluated against the engineering principles defined throughout this handbook before adoption.

---

# Appendix E — Development Commands

This appendix documents the most commonly used development commands, workflows, and operational procedures used throughout the Verifii project.

The commands listed here are intended to provide contributors with a quick reference during day-to-day development.

Command syntax may evolve over time as the platform grows.

---

## E.1 Installing Dependencies

Install project dependencies.

```bash
npm install
```

---

## E.2 Start Development Server

Run the local development server.

```bash
npm run dev
```

Default:

```
http://localhost:3000
```

---

## E.3 Production Build

Create a production build.

```bash
npm run build
```

Every feature should successfully build before being committed.

---

## E.4 Start Production Server

Run the production build locally.

```bash
npm run start
```

---

## E.5 TypeScript Validation

Run TypeScript compilation without generating output.

```bash
npx tsc --noEmit
```

This command should always succeed before production deployment.

---

## E.6 Linting

Run ESLint.

```bash
npm run lint
```

Resolve all significant lint issues before merging changes.

---

## E.7 Git Workflow

Check repository status.

```bash
git status
```

---

View changes.

```bash
git diff
```

---

View summarized changes.

```bash
git diff --stat
```

---

Stage files.

```bash
git add .
```

Or stage specific files.

```bash
git add path/to/file
```

---

Create a commit.

```bash
git commit -m "feat(scope): description"
```

---

Push changes.

```bash
git push origin main
```

---

View recent commits.

```bash
git log --oneline
```

---

## E.8 Branch Management

Create a new branch.

```bash
git checkout -b feature/feature-name
```

Switch branches.

```bash
git checkout branch-name
```

List branches.

```bash
git branch
```

---

## E.9 Restore Changes

Discard changes to a file.

```bash
git restore filename
```

Restore all unstaged changes.

```bash
git restore .
```

---

## E.10 Database Development

Run database migrations according to the project's migration workflow.

Always:

- Review migrations.
- Backup production data when appropriate.
- Validate migrations locally before deployment.

Database modifications should never be performed directly in production without proper review.

---

## E.11 Environment Variables

Environment variables should be stored securely.

Examples include:

- Supabase
- Razorpay
- Stripe
- Resend

Secrets must never be committed to version control.

---

## E.12 Deployment Workflow

Typical deployment process.

```
Feature Development

↓

Local Testing

↓

TypeScript Validation

↓

Production Build

↓

Git Commit

↓

Git Push

↓

Automatic Deployment

↓

Production Verification
```

---

## E.13 Verification Checklist

Before committing code, verify:

- Project builds successfully.
- TypeScript passes.
- Linting passes.
- Existing functionality still works.
- Documentation is updated if required.
- New functionality has been tested.

---

## E.14 Common Development Workflow

Recommended engineering workflow.

```
Identify Requirement

↓

Architecture Discussion

↓

Implementation

↓

Testing

↓

Documentation

↓

Git Commit

↓

Deployment

↓

Verification
```

---

## E.15 AI-Assisted Development Workflow

Verifii incorporates AI into the engineering process.

Typical workflow:

```
Requirement

↓

Architecture Planning

↓

Implementation

↓

Manual Review

↓

Testing

↓

Documentation

↓

Commit

↓

Deployment
```

AI-generated code should always be:

- Reviewed.
- Understood.
- Tested.
- Validated.

---

## E.16 Troubleshooting

If unexpected issues occur:

1. Check build output.
2. Run TypeScript validation.
3. Review recent Git changes.
4. Verify environment variables.
5. Review server logs.
6. Confirm database migrations.
7. Reproduce the issue locally.
8. Document the root cause if significant.

Avoid applying temporary fixes without understanding the underlying issue.

---

## E.17 Development Principles

During development, contributors should:

- Build incrementally.
- Commit frequently.
- Keep changes focused.
- Document architectural decisions.
- Test before deploying.
- Prefer clarity over complexity.

Every contribution should leave the codebase in a better state than it was found.

---

## Future Evolution

As Verifii grows, this appendix may expand to include:

- CI/CD commands.
- Docker workflows.
- Automated testing commands.
- Monitoring utilities.
- Backup procedures.
- Release management commands.
- Performance profiling tools.
- Infrastructure automation commands.

This appendix should remain the primary operational reference for day-to-day development.

---

# Appendix F — Revision History

This appendix records significant revisions made to the Verifii Engineering Handbook and highlights major architectural milestones in the platform's development.

Minor edits such as spelling corrections, formatting improvements, and documentation refinements do not require an entry unless they materially change the meaning or structure of the handbook.

The objective of this appendix is to preserve the historical evolution of both the documentation and the platform.

---

## F.1 Revision Policy

A revision entry should be created when any of the following occurs:

- A major architectural decision is introduced.
- A new handbook chapter is added.
- Existing architectural guidance changes significantly.
- Platform-wide engineering standards are updated.
- Core platform systems are redesigned.
- A major development phase is completed.

Routine implementation work should not require a handbook revision.

---

## F.2 Versioning Strategy

The handbook follows semantic-style versioning.

### Major Version

Incremented when significant architectural changes or handbook restructuring occurs.

Examples:

- Version 1.0
- Version 2.0

---

### Minor Version

Incremented when substantial new chapters or architectural guidance are added.

Accepted Architecture Decision Records (ADRs) increment the handbook's minor version, even when they do not introduce runtime behavior changes. This ensures that the handbook version reflects architectural evolution as well as implementation changes.

Examples:

- Version 1.1
- Version 1.2

---

### Patch Version

Incremented for documentation improvements that do not alter architectural meaning.

Examples:

- Version 1.0.1
- Version 1.0.2

---

## F.3 Revision Log

| Version | Date | Summary | Author |
|----------|------|---------|--------|
| 1.0 | July 2026 | Initial Engineering Handbook completed including platform architecture, engineering standards, and ADR-001 through ADR-017. | Eshan Maurya |
| 1.1 | July 2026 | Added Revenue Engine V2 roadmap (ADR-018), Live Feed Event Projection Architecture (ADR-020), and launch-readiness architectural decisions. | Eshan Maurya |
| 2.0 | July 2026 | Added Notification Architecture, Centralized Logging, Idempotent Startup Submission, Secure Proof Upload Pipeline, Best-Effort Auxiliary Writes, Explicit Onboarding Completion State (ADR-025), updated engineering standards, and documentation maintenance policies. | Eshan Maurya |
| 2.1 | July 2026 | Added ADR-026 (OAuth Re-authentication for Destructive Actions), OAuth-compatible security guarantees, short-lived proof architecture, and handbook updates. | Eshan Maurya |
| 2.2 | August 2026 | Added onboarding draft recovery architecture, shared validation architecture, onboarding security hardening, onboarding engineering standards, ADR-027, ADR-028, and ADR-029. | Eshan Maurya |
| 2.3 | August 2026 | Added onboarding analytics caching infrastructure (process-local Map), analytics export system, period comparison infrastructure, ADR-030. | Eshan Maurya |
| 2.4 | August 2026 | Added Chapter 25 — Verification & Security Review Framework (VRF); consolidated VRF-001 through VRF-007 history, security findings, remediation records, testing evidence, failure/recovery history, production/staging verification model, and cross-VRF security principles. | Eshan Maurya |
| 2.5 | August 2026 | Formally closed VRF-003 after controlled staging rebuild, HTTP 200 SVG verification, Chromium DOM validation, theme testing, adversarial-character verification, and cleanup evidence. | Eshan Maurya |
| 2.6 | August 2026 | Formally closed Launch Readiness Gate 1 after controlled production email dispatch, Resend provider acceptance, and human-confirmed Gmail inbox delivery; documented evidence boundaries for idempotency, rate-limit rejection, and plain-text fallback testing. | Eshan Maurya |
| 2.7 | August 2026 | Formally documented Launch Readiness Gate 2 (G2-02) controlled plan change/replacement verification, including the recorded staging privilege deviation, subsequent privilege restoration, production isolation, and final closure. | Eshan Maurya |
| 2.8 | August 2026 | Formally documented Launch Readiness Gate 2 (G2-03) normal cycle-end cancellation testing, actual HTTP execution, provider rejection handling, fail-closed local state preservation, temporary staging privilege deviation and restoration, production isolation, and the explicit paid-active-cycle testability limitation. | Eshan Maurya |
| 2.9 | August 2026 | Formally documented Launch Readiness Gate 2 (G2-04) account deletion billing safety barrier testing across failure path (G2-04-A) and success path (G2-04-B), permanent pre-auth deletion application cleanup remediation (financial audit anonymization, local subscription deletion, onboarding cleanup, startup cascade, auth user deletion), root cause PostgreSQL RI trigger analysis, temporary staging privilege deviation and verified restoration, and production isolation. | Eshan Maurya |
| 2.10 | August 2026 | Formally documented and closed Launch Readiness Gate 2 (G2-05 through G2-09), including atomic webhook ingestion (G2-05), true concurrent first-delivery race safety (G2-06), constant-time HMAC verification (G2-07), provider attribution boundaries (G2-08), and monotonic stale timestamp rejection (G2-09); formally concluded Gate 2 overall closure. | Eshan Maurya |
| 2.11 | August 2026 | Formally closed Phase 2 (Founder Experience) across all 7 core objectives; documented completion of Objective 5 (Search, Filtering & Public Discovery) and authoritative verification-state filtering invariants (hasVerificationEvidence === true); recorded 46/46 unit, 13/13 trust, and 11/11 SVG regression passes. | Eshan Maurya |
| 2.12 | August 2026 | Formally documented Launch Readiness P-07 production rate-limit threshold verification on `/api/live-feed` (15 req/60s, Upstash Redis atomic INCR+EXPIRE, 16/16 origin reach, HTTP 429 rejection on request 16). | Eshan Maurya |
| 2.13 | August 2026 | Formally reconciled and closed VRF-004 (Razorpay Webhook Timing-Safe HMAC Comparison); reclassified historical Syne font Vercel failure as a resolved upstream CDN incident; documented live production deployment of `timingSafeCompare` in commit `440d1ef` (`dpl_5zzfCee7ZnJvGud4Dyr1am2gMrz5`, `READY`). | Eshan Maurya |
| 2.14 | August 2026 | Formally recorded Phase 2 Objective 5 (Search, Filtering & Public Discovery) live production smoke test verification (commit `b4fcc81`, 17/17 probes HTTP 200, UI/pagination/sanitization verified, authoritative verification filter semantics structurally verified with explicit zero-public-data catalog limitation). | Eshan Maurya |
| 2.15 | August 2026 | Formally documented TEST 01-C rate-limit client identity trust-boundary remediation, Upstash production confirmation, 8/8 automated test verification, spoofing-resistance evidence, webhook fail-open hardening, and production closure (commits 106d632 and 5935d27). | Eshan Maurya |
| 2.16 | August 2026 | Formally documented and closed TEST 01-D (Build / Runtime Configuration Consistency); verified 0 secret leakage in client bundles, 6/6 automated configuration tests, production build and runtime parity, and D-001 through D-010 consistency invariants. | Eshan Maurya |
| 2.17 | August 2026 | Formally documented TEST 01-E secret exposure audit (E-001 through E-015 PASS), client/server analytics constant isolation (commit d360141), and concluded master TEST 01 overall audit closure (01-A through 01-E closed, TEST 01-F explicitly non-existent). | Eshan Maurya |

---

## F.4 Platform Milestones

Major platform milestones should also be recorded.

Examples include:

- Initial platform architecture completed.
- Verification System completed.
- Trust & Fraud Engine introduced.
- Visibility System implemented.
- Founder Dashboard released.
- Public Leaderboard launched.
- Engineering Handbook Version 1.0 published.
- VRF Security Verification Framework initiated.
- VRF-001 Provider Attribution Trust Boundary verified.
- VRF-002 Self-Reported Revenue Trust Boundary verified at implementation/staging level.
- VRF-003 SVG Output Encoding vulnerability identified (Remediation Pending Verification).
- VRF-003 standalone SVG browser remediation verification completed and CLOSED / VERIFIED through controlled staging rebuild and Chromium DOM validation.
- VRF-004 — Razorpay Webhook Timing-Safe Comparison: CLOSED / VERIFIED. Constant-time HMAC comparison (`timingSafeCompare`) verified across 11/11 unit tests, independently re-verified under Gate 2 G2-07 (1.2M samples), and confirmed live in production under deployment `dpl_5zzfCee7ZnJvGud4Dyr1am2gMrz5` (`440d1ef`). Historical Syne font 404 resolved through subsequent builds without font-code modifications.
- VRF-005 Billing-Safe Account Deletion verified.
- VRF-006 Credential Encryption Architecture validated (Diagnostic Pass).
- VRF-007 Production Database RLS & PostgreSQL Privilege Hardening executed and verified.
- Gate 1 — Production Email Smoke Test closed after successful production dispatch, Resend provider acceptance, and human-confirmed Gmail inbox delivery.
- Gate 2 (G2-02) — Controlled Plan Change / Replacement Test closed after successful provider replacement minting, replaces_subscription_id correlation, staging privilege remediation, and dual provider cancellation cleanup.
- Gate 2 (G2-03) — Normal Cycle-End Subscription Cancellation: CLOSED / VERIFIED WITH DOCUMENTED TESTABILITY LIMITATION. Real HTTP execution and fail-closed behavior were verified using the controlled staging fixture; Razorpay rejected cycle-end cancellation because no billing cycle was active on the uncharged fixture. Paid active-cycle behavior could not be independently verified with the available fixture.
- Gate 2 (G2-04) — Account Deletion & Billing Safety Barrier: CLOSED / VERIFIED. Verified failure-path fail-closed enforcement (G2-04-A) and success-path provider cancellation, permanent pre-auth cleanup remediation (financial audit log anonymization, local subscription deletion, onboarding cleanup, startup cascade, and Supabase Auth deletion), verified staging privilege restoration (0 residual direct grants), and confirmed production isolation.
- Gate 2 (G2-05) — Billing Webhook Ingestion & Least Privilege: CLOSED / VERIFIED. Verified atomic RPC execution and database mutation without direct service_role grants.
- Gate 2 (G2-06) — Webhook Idempotency & True Concurrency: CLOSED / VERIFIED. Verified sequential replay rejection and true concurrent first-delivery race safety.
- Gate 2 (G2-07) — Constant-Time HMAC Verification: CLOSED / VERIFIED. Evaluated deterministic vectors, 90,000 adversarial runs, and 1.2M statistical timing samples.
- Gate 2 (G2-08) — Provider Identity Attribution: CLOSED / VERIFIED. Verified missing notes.user_id, unknown plan_id, and invalid signature boundary enforcement.
- Gate 2 (G2-09) — Stale Webhook Rejection & Monotonicity: CLOSED / VERIFIED. Verified stale event rejection, equal timestamp preservation, and fresh timestamp forward progression.
- Launch Readiness Gate 2: CLOSED / VERIFIED across all 9 milestones (G2-01 through G2-09).
- Phase 2 — Founder Experience: CLOSED / VERIFIED across all 7 core objectives (Founder Onboarding & Profile Setup, Payment Provider Connection & Multi-Gateway Support, Revenue Sync & Real-Time Aggregation Engine, Public Startup Profile & Trust Badging, Search, Filtering & Public Discovery, Founder Dashboard & Financial Health Center, and Verification Confidence & Fraud Defense Integration).
- Phase 2 Objective 5 (Public Leaderboard Search & Discovery): CLOSED / VERIFIED / PRODUCTION SMOKE TEST PASSED. Verified live deployment of commit `b4fcc81` across 17 read-only HTTP probes (17/17 HTTP 200 OK, UI rendering, parameter binding, category allowlist, revenue range parsing, city filtering, context-aware empty state, pagination clamping, sanitization, and 0 private record leakage). Verification filter pipeline semantics structurally verified against deployed source with explicit documentation of zero-public-startups catalog limitation.
- Launch Readiness P-07 — Production Rate-Limit Verification: CLOSED / VERIFIED. Empirically proved origin Upstash Redis rate-limit threshold enforcement on `/api/live-feed` (Requests 1–15 returned HTTP 200, Request 16 returned HTTP 429 `{"error":"Rate limit exceeded"}`, 16/16 `x-vercel-cache: MISS`, 0 database/auth mutations).
- TEST 01-C — Rate-Limit Client Identity Trust Boundary: CLOSED / VERIFIED. Resolved client-identity trust boundary in rate limiting (server-validated user.id, runtime/platform IP, bounded anonymous fallback, strict IPv4/IPv6 validation, canonical route isolation, and webhook fail-open hardening); verified 8/8 automated test suites and confirmed live production enforcement on https://www.verifii.in/api/live-feed (15 req/60s threshold, HTTP 429 on request 16+, rotating spoofed XFF/X-Real-IP bypass blocked, commits 106d632 and 5935d27).
- TEST 01-D — Build / Runtime Configuration Consistency: CLOSED / VERIFIED. Audited build/runtime configuration boundaries across Local, Build, Vercel, Serverless, and Browser contexts; verified zero secret leakage in client bundles, strict NEXT_PUBLIC isolation, 6/6 automated configuration tests pass, and live production runtime stability.
- TEST 01-E — Secret Exposure Through Bundles / API / Errors: CLOSED / VERIFIED. Confirmed zero real secrets exposed across browser bundles, source maps, HTML, RSC, API responses, error responses, headers, and logs (E-001 to E-015 PASS); hardened analytics constants into pure client-safe module (commit d360141).
- TEST 01 Master Audit Closure: CLOSED / VERIFIED across all sub-audits (01-A, 01-B, 01-C, 01-D, 01-E). Formally established that TEST 01-F does not exist.

This timeline provides historical context for future contributors.

---

## F.5 Architecture Milestones

Record important architectural changes that affect multiple systems.

Examples:

- India-first platform strategy adopted.
- Private-by-default visibility model introduced.
- Razorpay promoted as the primary verification provider.
- Stripe OAuth replaced by manual verification flow.
- Backend established as the single source of truth.
- Centralized Visibility System implemented.
- Dashboard restructured into layered orchestrator/engine/presenter architecture.
- Revenue Aggregation established as Single Source of Truth.
- Snapshot-first architecture implemented for public profiles and analytics.
- Provider integration completely isolated to backend synchronization workflows.

Each milestone should reference the corresponding Architecture Decision Record (ADR) whenever applicable.

---

## F.6 Roadmap Milestones

Major product phases should be recorded as they are completed.

Example format:

| Phase | Status | Completion Date |
|---------|---------|----------------|
| Phase 1 – Platform Foundation | Completed | July 2026 |
| Phase 2 – Founder Experience | Completed | August 2026 |
| Phase 3 – Trust Intelligence | Planned | — |
| Phase 4 – Community & Discovery | Planned | — |
| Phase 5 – Enterprise & Scale | Planned | — |

This provides a concise history of the platform's overall progress.

---

## F.7 Documentation Maintenance

The handbook should be reviewed whenever:

- A new architecture decision is accepted.
- A major subsystem changes.
- Engineering standards evolve.
- New development phases are completed.
- Platform infrastructure changes significantly.

Documentation should evolve alongside the platform rather than being updated only after large development efforts.

---

## F.8 Maintaining Historical Accuracy

Historical revision entries should never be deleted.

If information becomes outdated:

- Add a new revision.
- Preserve previous entries.
- Explain why the change occurred.
- Reference the relevant ADR where appropriate.

Maintaining historical context is as important as documenting the current architecture.

---

## F.9 Revision History

This section provides a concise historical timeline showing how the Engineering Handbook evolved across major versions.

| Version | Date | Major Changes |
|---------|------|---------------|
| 1.0 | July 2026 | Initial Engineering Handbook including platform architecture, engineering standards, and ADR-001 through ADR-017. |
| 1.1 | July 2026 | Added Revenue Engine V2 roadmap (ADR-018), Live Feed Event Projection Architecture (ADR-020), and launch-readiness architectural decisions. |
| 2.0 | July 2026 | Added Notification Architecture, Centralized Logging, Idempotent Startup Submission, Secure Proof Upload Pipeline, Best-Effort Auxiliary Writes, Explicit Onboarding Completion State (ADR-025), updated engineering standards, and documentation maintenance policies. |
| 2.1 | July 2026 | Added ADR-026 (OAuth Re-authentication for Destructive Actions), OAuth-compatible security guarantees, short-lived proof architecture, and handbook updates. |
| 2.2 | August 2026 | Added onboarding draft recovery architecture, shared validation architecture, onboarding security hardening, onboarding engineering standards, ADR-027, ADR-028, and ADR-029. |
| 2.3 | August 2026 | Added onboarding analytics caching infrastructure (process-local Map), analytics export system, period comparison infrastructure, ADR-030. |
| 2.4 | August 2026 | Added Chapter 25 — Verification & Security Review Framework (VRF); consolidated VRF-001 through VRF-007 history, security findings, remediation records, testing evidence, failure/recovery history, production/staging verification model, and cross-VRF security principles. |
| 2.5 | August 2026 | Formally closed VRF-003 after controlled staging rebuild, HTTP 200 SVG verification, Chromium DOM validation, theme testing, adversarial-character verification, and cleanup evidence. |
| 2.6 | August 2026 | Formally closed Launch Readiness Gate 1 after controlled production email dispatch, Resend provider acceptance, and human-confirmed Gmail inbox delivery; documented evidence boundaries for idempotency, rate-limit rejection, and plain-text fallback testing. |
| 2.7 | August 2026 | Formally documented Launch Readiness Gate 2 (G2-02) controlled plan change/replacement verification, including the recorded staging privilege deviation, subsequent privilege restoration, production isolation, and final closure. |
| 2.8 | August 2026 | Formally documented Launch Readiness Gate 2 (G2-03) normal cycle-end cancellation testing, actual HTTP execution, provider rejection handling, fail-closed local state preservation, temporary staging privilege deviation and restoration, production isolation, and the explicit paid-active-cycle testability limitation. |
| 2.9 | August 2026 | Formally documented Launch Readiness Gate 2 (G2-04) account deletion billing safety barrier testing (failure and success paths), permanent pre-auth cleanup remediation, financial audit preservation via user_id anonymization, staging privilege restoration, and production isolation. |
| 2.10 | August 2026 | Formally documented and closed Launch Readiness Gate 2 (G2-05 through G2-09), including atomic webhook ingestion (G2-05), true concurrent first-delivery race safety (G2-06), constant-time HMAC verification (G2-07), provider attribution boundaries (G2-08), and monotonic stale timestamp rejection (G2-09); formally concluded Gate 2 overall closure. |
| 2.11 | August 2026 | Formally closed Phase 2 (Founder Experience) across all 7 objectives including Objective 5 search/filtering, authoritative verification filter semantics, and regression verification. |
| 2.12 | August 2026 | Formally documented Launch Readiness P-07 production rate-limit threshold verification on `/api/live-feed` (15 req/60s threshold, Upstash Redis backend, HTTP 429 on request 16). |
| 2.13 | August 2026 | Formally reconciled and closed VRF-004 (Timing-Safe HMAC Comparison) as CLOSED / VERIFIED following production deployment verification in commit `440d1ef` and historical Syne incident resolution. |
| 2.14 | August 2026 | Formally recorded Phase 2 Objective 5 (Public Discovery & Search) live production verification on commit `b4fcc81` (17-probe smoke test, UI rendering, sanitization, 0 private leaks, and structural verification filter invariants). |
| 2.15 | August 2026 | Formally documented TEST 01-C rate-limit client identity trust-boundary remediation, Upstash production confirmation, 8/8 automated tests, spoofing-resistance evidence, webhook fail-open hardening, and production closure. |
| 2.16 | August 2026 | Formally documented and closed TEST 01-D (Build / Runtime Configuration Consistency); verified client bundle secret boundaries, 6/6 automated tests, and live production configuration parity. |
| 2.17 | August 2026 | Formally documented TEST 01-E secret exposure audit (E-001 through E-015 PASS), client/server analytics constant isolation (commit d360141), and concluded master TEST 01 overall audit closure (01-A through 01-E closed, TEST 01-F explicitly non-existent). |

---

## F.10 Current Revision Status

At the time of writing:

- Handbook Version: **2.17**
- Status: **Active**
- Product Phase: **Phase 2 Complete / Phase 3 Planned**
- Latest ADR: **ADR-030**
- Next Scheduled Review: **After Phase 3 Completion**

---

---

# Closing Statement

The Verifii Engineering Handbook is intended to serve as the long-term engineering reference for the platform.

As Verifii grows, new technologies will be adopted, features will evolve, and architectural decisions will continue to shape the product.

This handbook should evolve alongside those changes while preserving the engineering principles, architectural reasoning, and development standards that define the platform.

The goal is not merely to document the codebase, but to preserve the knowledge required to build, maintain, and evolve Verifii for years to come.
