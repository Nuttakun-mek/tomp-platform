# TES-000 Product Constitution

## Purpose

This document defines the non-negotiable principles of TOMP. Every future design, feature, database table, API, and user interface must comply with this constitution.

## Product Identity

TOMP is a Transportation Operations Management Platform. It supports the company in planning, preparing, publishing, operating, recovering, reviewing, and improving transportation service operations.

## What TOMP Is

TOMP is:

- A transportation operations platform.
- A coordination platform.
- A service assurance platform.
- A digital operating system for event-based transportation operations.
- A system for preserving company operational know-how.

## What TOMP Is Not

TOMP is not:

- A fleet maintenance system.
- A general ERP.
- A CRM.
- A payroll system.
- An accounting system.
- A navigation engine.
- A hardware GPS business.
- A system designed to control drivers.

## Product North Star

TOMP must help the company manage more transportation projects with fewer coordination burdens while maintaining or improving professional service quality.

## Constitutional Principles

### Principle 1: Business First, Technology Second

Technology choices must support business operations. The business must not be forced to work around the software.

### Principle 2: People Decide, System Supports

TOMP may suggest, warn, detect, or highlight, but humans remain the final decision-makers.

### Principle 3: One Source of Truth

Project, mission, assignment, driver, vehicle, call sign, and timeline data must have one authoritative source.

### Principle 4: Data Entered Once, Used Everywhere

The same data must not be repeatedly entered across forms, spreadsheets, chats, or systems.

### Principle 5: Publish Creates Baseline

Before publish, a plan can be edited. After publish, every adjustment must be recorded as a change event.

### Principle 6: Event Before Report

Reports must be generated from events, not manually reconstructed after work ends.

### Principle 7: Timeline Is the Operational Black Box

All important operational changes must be recorded in the timeline.

### Principle 8: Google Maps for Navigation, TOMP for Operations

TOMP does not build its own navigation engine in the first version. Drivers use Google Maps deep links. TOMP manages assignments, statuses, timelines, readiness, and recovery.

### Principle 9: GPS Supports Visibility, Not Control

GPS helps operations see readiness and movement, but GPS loss must not break the operation.

### Principle 10: QR First for Temporary Drivers

Drivers who are not regular employees must be able to access only their own call sign and assignment by QR.

### Principle 11: Full Vision, Progressive Delivery

The architecture must support the full vision, but features are enabled progressively.

### Principle 12: Zero Cost First

The first pilot must run with free or near-free tools as long as the business scale is still small.

### Principle 13: No Rewrite

Core objects, lifecycle, assignment model, call sign concept, timeline, and event model must be stable enough to grow without major rewrite.

### Principle 14: Configuration Over Hardcode

Freeze windows, SLA, statuses, issue types, vehicle types, mission types, notification priorities, and checklist templates must be configurable.

### Principle 15: Exception Before Routine

Mission Control must highlight exceptions and risks rather than overwhelm users with normal operations.

### Principle 16: Operational Memory Belongs to the Company

Knowledge from projects, venues, vendors, drivers, organizers, incidents, and recovery must be captured for future projects.
