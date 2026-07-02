# Project 1: AI Task Manager

| Field | Detail |
|---|---|
| Project Number | 1 |
| Project Name | AI Task Manager |
| Tier | Junior |
| Deadline | 10 working days (2 weeks) from your start date |
| Status | Active |
| Tags | REST API, Authentication, Authorization, Database Design, WebSockets, Prompt Engineering, AI Tool Calling, Test Driven Development, Git Workflow, Code Review, Debugging, System Design Documentation |

---

## Overview

You are building an AI Task Manager: a tool where people organize their work into workspaces, projects, and tasks, and can also manage that work by talking to a chat agent in plain language.

Please read this brief in full before you start building. The problem itself is written in plain, simple language on purpose. The challenge is not in understanding what a task manager is. It is in everything underneath: designing a proper multi level database, enforcing permissions correctly, keeping data in sync in real time, sending real emails, and building an AI feature that stays inside clear boundaries instead of doing whatever a user types at it.

The goal of this project is to build real, usable capability: the kind you could confidently use, explain, and build on again later.

To help you picture the shape of what you are building, think of something in the spirit of a lightweight ClickUp or Trello: workspaces that contain projects, which contain tasks. That comparison is only there to help you picture it. The specification below is what you are actually building and what you will be assessed against.

---

## Covered Areas

| Category | Area |
|---|---|
| Programming and Stack Fundamentals | Backend Language Proficiency |
| Programming and Stack Fundamentals | API Construction |
| Programming and Stack Fundamentals | Database Design |
| AI and LLM Fundamentals | Model Concepts |
| AI and LLM Fundamentals | Prompt Engineering |
| AI and LLM Fundamentals | Everyday AI Tooling |
| SDLC and Engineering Practices | Development Lifecycle |
| SDLC and Engineering Practices | Version Control |
| SDLC and Engineering Practices | Code Review |
| SDLC and Engineering Practices | Testing Discipline |
| SDLC and Engineering Practices | Debugging |
| Communication and Client Readiness | Technical Explanation |

Communication and Client Readiness is trained through the Review and Presentation section below, alongside the technical build, rather than as a separate piece of work.

---

## What Is Tested

By the end of this project, you should be able to show, on request:

- A relational schema with real parent child relationships and correctly enforced constraints, not a single flat table.
- A REST API with a sensible endpoint structure, correct use of HTTP methods, and correct status codes for success and failure.
- Authentication that supports two real methods, and authorization that is enforced on the server, not just hidden in the interface.
- An AI feature that uses an LLM with clear guardrails, rather than passing raw user input straight to a model.
- Evidence of a full development lifecycle: requirements, design, build, test, and documentation, not just a finished app.
- Reading, reviewing, and responding to feedback on your own pull request.
- Diagnosing and fixing a real bug through systematic troubleshooting rather than guesswork.
- Explaining what you built, and why you built it that way, in plain language, in writing, on video, and live.

## What Is Learned

- How to translate a real hierarchy of people, teams, projects, and tasks into a relational schema, including the foreign key and cascading delete decisions that come with it.
- How authentication and authorization actually work, including a full sign in flow and a role based permission system.
- The difference between authentication (who you are) and authorization (what you are allowed to do), and where each one belongs in your code.
- How WebSockets differ from polling, and why real time syncing needs a different approach than a normal request and response API.
- How to send real transactional email through a provider such as Gmail, rather than only showing an in-app message.
- How to use system prompts, structured outputs, and tool calling to build an AI feature that stays inside its intended boundaries.
- Why tests are written the way they are, and what writing a test before the code feels like in practice, even if it is not your default habit afterward.
- What a healthy git history looks like, and why short lived feature branches and real pull requests matter, even when working alone.

## What Is Practiced

- The full development lifecycle, in order: requirements and planning, implementation and deployment, testing, and demo and presentation. Each phase is described in full further down.
- Git workflow discipline: short lived feature branches, meaningful commit messages, and at least one real pull request, reviewed by yourself with fresh eyes or by a peer if one is available.
- Writing a test plan as its own document before or alongside writing tests, deciding what should be tested and why.
- Test driven development where practical: writing a failing test before writing the code that makes it pass, at least for the core task and permission logic.
- Debugging a real, deliberately introduced defect through systematic diagnosis rather than trial and error.
- Presenting your own work out loud and explaining your decisions clearly.

---

## Prerequisites

Before starting, you should already be comfortable with the following. If you already know one of these, do not skip it. Ask your AI Instructor for a short, fast revision and a few check questions to confirm you still remember it correctly, then move on.

- Basic programming in at least one language
- Command line basics: navigating folders, running scripts
- Git fundamentals: clone, commit, push, pull, and branching
- How HTTP requests and responses work
- Basic relational database concepts: tables, rows, columns, and keys

### Setting up your AI Instructor and troubleshooting partner

Two ready made skills are included in this repository, in the `skills/` folder. A skill is a markdown file that tells Claude how to act in a particular mode. Add both to your Claude project before you start.

- **Learning agent** (`skills/teach-me/SKILL.md`). Say "teach me" followed by a topic, for example "teach me OAuth", and it walks you through it one step at a time, has you do the work yourself, and asks you for a confidence score at the end. Save that score and reflection in `LEARNING_LOG.md`.
- **Troubleshooting agent** (`skills/troubleshoot/SKILL.md`). Describe what has broken and it guides you to the cause instead of handing you the fix.

Use the learning agent for everything in How to Learn This below, including revising anything you already know.

---

## How to Learn This

Work through the concepts below before you build the matching part of the project. For each one, you have three ways to learn it. Use the AI option first for a quick, interactive explanation, then confirm your understanding against the official documentation for real depth. The video option is there for anything easier to understand in motion than in text.

| Topic | Learn With Your AI Instructor | Official Documentation | Optional Video Reference |
|---|---|---|---|
| Development lifecycle refresher | Ask it to walk you through why each stage exists and what skipping it costs you | See the Project Phases section below | Search for a short explainer if the idea feels abstract |
| Authentication and OAuth | Ask it to explain the sign in flow step by step, then quiz you on it | Google Identity Platform documentation | A short walkthrough of a Google sign in flow |
| Username and password authentication | Ask it to explain password hashing and why plain text storage is unsafe | Your chosen backend framework's authentication documentation | Optional |
| Authorization and role based access | Ask it to test you with scenarios: can this role do this action | See the Permissions Matrix below, which you will implement | Optional |
| Relational database design | Ask it to review your schema sketch before you build it | Your chosen database's official documentation | A short video on normalization if the concept is new |
| WebSockets and real time sync | Ask it to explain the difference from polling and Server Sent Events | MDN's WebSocket documentation, then your chosen library's documentation | A short demo of real time sync in action |
| Gmail integration for notifications | Ask it to explain how a server sends email through Gmail safely | Google Cloud Console and Gmail API documentation | Optional |
| Prompt engineering and tool calling | Ask it to explain grounding and why it matters, then have it quiz you | Your chosen AI provider's official API documentation | Optional |
| Test driven development | Ask it to walk you through a red, green, refactor example in your language | A short official guide from your test framework of choice | A short demonstration is often clearer than text here |
| Git branching and pull requests | Ask it to explain a typical feature branch workflow | GitHub's own documentation on branching and pull requests | Optional |

Structured paid courses are not required at the moment. If you are still stuck after trying the options above, speak with your mentor before looking for a course.

### Work manually first, then let AI accelerate the rest

Sketch the database schema and the permission model yourself, on paper, in a diagram tool, or talked through out loud with your AI Instructor, before you generate any of it. Once you understand what you are building and why, using a coding agent to accelerate the actual typing and boilerplate is expected and encouraged, since that mirrors how this work is done professionally. What matters is that you can explain your own decisions afterward, in your own words, without notes.

---

## Electives: Underlying Skills You Will Also Learn

This project can be handed to a resource working independently, so if any of the following are new to you, treat them as part of the project, not a separate task. Pick the options that match your chosen stack.

**Frontend**
- React: component structure, state management, and forms. Official documentation: react.dev
- Next.js: routing, server rendering, and API routes. Official documentation: nextjs.org/docs

**Backend**
- Express (Node.js): routing, middleware, and request handling. Official documentation: expressjs.com and nodejs.org
- FastAPI (Python): routing, dependency injection, and request validation. Official documentation: fastapi.tiangolo.com

**Database**
- A relational database of your choice, such as PostgreSQL or SQLite. Learn the core operations (create, read, update, delete), normalization, and how relations and foreign keys work between tables. Official documentation: postgresql.org/docs or sqlite.org/docs

---

## Recommended Stack

This project can be built in any stack or language you choose. If you are unsure where to start, a solid recommendation is React paired with Express, or Next.js on its own for both the frontend and the API routes. Any relational database is acceptable. This project, and every project in this library, is designed to be language and framework independent, so the choice of tools is yours to make and defend.

---

## The Exact Brief

Build the AI Task Manager.

**Authentication.** Support two working sign in methods: Google sign in, and a traditional username or email with a password. Passwords must be hashed properly, never stored in plain text.

**Data hierarchy.** This is the real database design challenge in this project, so take it seriously.

```
User
  belongs to one or more Workspaces
    Workspace
      contains one or more Projects
        Project
          contains one or more Tasks
            Task
              title
              description
              status (for example: to do, in progress, done)
              priority
              due date
              assignee (a User who is a member of the workspace)
              at least one custom field of your own design
```

A user can belong to more than one workspace. Deleting a workspace, a project, or a task should behave sensibly for everything beneath it. Decide and document what "sensibly" means for each case (cascading delete, soft delete, or blocking deletion until children are removed), and be ready to explain why you chose what you chose.

**Authorization.** Access is role based and scoped per workspace. Implement at least four roles: Owner, Admin, Member, and Viewer. Use the permissions matrix below as your specification, and enforce it on the server. A Viewer sending a delete request directly to your API should receive a real permission error, not just have the delete button hidden in an interface they never see.

### Permissions Matrix

| Module | Owner | Admin | Member | Viewer |
|---|---|---|---|---|
| Workspace settings | Create, Read, Update, Delete | Read, Update | Read | Read |
| Workspace members | Create, Read, Update, Delete | Create, Read, Update | Read | Read |
| Project | Create, Read, Update, Delete | Create, Read, Update, Delete | Create, Read, Update | Read |
| Task | Create, Read, Update, Delete | Create, Read, Update, Delete | Create, Read, Update, Delete | Read |

Add rows for any additional module you introduce, in this same format.

**The chat agent.** Build a conversational interface, text in and text out is enough, where a user can type natural language requests and have the agent act on them within their permissions. At minimum it should be able to create a task, update a task, prioritize or re-prioritize tasks, and set a reminder, all through conversation rather than a form. This is your grounded AI feature: give it explicit tools for the actions it can take, and make sure it respects the same permission rules as the rest of the app. It should not be able to do something on a user's behalf that the user is not allowed to do themselves.

**Real time sync.** Changes should propagate to other open sessions over WebSockets. For example, if a task is updated in one browser tab or device, another open session for the same workspace should see the update without a manual refresh.

**Reminders and notifications.** Tasks can have a reminder attached (a date and time), and there should be a real, working mechanism that fires when a reminder is due. Send this as a real email using Gmail integration through Google Cloud Console (the Gmail API), in addition to any in-app notification. This also gives you a real use for the same Google account setup you used for sign in.

**Backend access.** Build the backend so it serves your frontend directly, and also expose it as a standalone API that can be accessed independently using a token, so another client could use it without the frontend.

**Quality bar.** Ship this with:
- A real automated test suite covering the core task and permission logic, with the core paths written test-first.
- A test plan, written as its own document, describing what is tested and why.
- Real git history: short lived feature branches, meaningful commits, and at least one pull request you review yourself, or with a peer, before merging.
- One deliberately introduced bug that you trace and fix through systematic debugging, documented in your reflection notes: what the symptom was, how you found the root cause, and how you fixed it.

---

## Requirements and Scope

**In scope:**
- Two working sign in methods: Google and username or email with password
- The Users, Workspaces, Projects, Tasks hierarchy described above
- Role based permissions enforced server-side, matching the permissions matrix
- A REST API covering the full hierarchy
- A chat agent that can create, update, prioritize, and set reminders on tasks via natural language, respecting permissions
- Real time sync of task changes across open sessions
- A working reminder mechanism that sends real email through Gmail integration
- A backend that serves the frontend and is also independently accessible through a token based API
- Automated tests, a test plan, real git and pull request history, and one traced and fixed bug

**Out of scope for this project:**
- Continuous integration or automated deployment pipelines
- Containerized or multi-environment deployment infrastructure
- A fully polished, designed frontend. Functional and usable is enough; this is not a design project
- Support for more than one AI model provider, or any model fine-tuning
- Additional sign in providers beyond Google, or enterprise authentication protocols

**Definition of done, in plain language:** someone unfamiliar with your project can clone your repository, follow your README, sign in, create a workspace with a project and some tasks, manage tasks by talking to the chat agent, receive a real reminder email, and watch a second browser tab update in real time, and you can explain every decision you made along the way without notes.

---

## Project Phases

This project is organized into four phases. Work through them in order.

### Phase 1: Requirements and Planning

Substeps:
- Read this brief fully and complete the relevant items in How to Learn This
- Write your own requirements notes based on the brief
- Design your data model and sketch the schema by hand before generating anything
- Draw your system diagram
- Confirm your understanding of the permissions matrix and how you will enforce it

Artifacts produced:
- `docs/srs.md`, your Software Requirements Specification
- `docs/system-diagram.drawio`, your architecture diagram, created in draw.io
- `docs/requirements.md`, your requirements notes

### Phase 2: Implementation and Deployment

Substeps:
- Set up your project structure from the template
- Build your database schema and migrations
- Build authentication and authorization
- Build the REST API endpoints
- Build the chat agent and its grounded AI feature
- Build real time sync
- Build the Gmail integration for reminders and notifications
- Connect the frontend, and confirm the backend also works as a standalone token based API
- Deploy to a reachable environment

Artifacts produced:
- Working source code in `src/`
- `docs/design.md`, your design decisions and the reasoning behind them

### Phase 3: Testing

Substeps:
- Write your test plan before or alongside your tests
- Write automated tests, test-first for the core task and permission logic
- Run a full manual pass through the app
- Introduce and then find and fix one deliberate bug through systematic debugging

Artifacts produced:
- Automated tests in `tests/`
- `docs/test-plan.md`, your test plan

### Phase 4: Demo and Presentation

Substeps:
- Polish your `README.md` so a stranger can run the project from it alone
- Complete your reflection
- Record a short Loom video walking through what you built
- Prepare a short written summary
- Schedule and deliver your live presentation

Artifacts produced:
- `docs/reflection.md`, your completed reflection
- A finished `README.md`
- A Loom video link and a written summary, both linked from your README

---

## Artifact and Folder Guide

| Artifact | Format | Location |
|---|---|---|
| Software Requirements Specification | Markdown | `docs/srs.md` |
| System diagram | draw.io | `docs/system-diagram.drawio` |
| Requirements notes | Markdown | `docs/requirements.md` |
| Design notes | Markdown | `docs/design.md` |
| Test plan | Markdown | `docs/test-plan.md` |
| Reflection | Markdown | `docs/reflection.md` |
| Source code | Your chosen language | `src/` |
| Automated tests | Your chosen language | `tests/` |
| Learning log | Markdown | `LEARNING_LOG.md` |
| Submission | Markdown | `PRESENTATION.md` |
| Screenshots and other evidence | Images or links | `proof/` |

Empty starter files for each of these already exist in the repository structure below, so you always know exactly where each artifact belongs.

---

## How this works

- Fork the project repository that has been shared with you.
- Work through this brief in order, inside your fork.
- As you finish each part, commit your work and save your proof (a link or a screenshot) into the `proof` folder.
- Keep `LEARNING_LOG.md` updated as you go, one entry per skill, produced with your teach-me skill.
- When everything is done, fill in `PRESENTATION.md` with every link, artifact, and proof of learning.
- Add your mentor as a collaborator on your fork.
- Schedule a call and present your work.

## Repository structure

The repository is already set up in this shape, so you always know where something goes:

```
project-1-ai-task-manager/
  README.md              This brief. Read it, do not edit it.
  PRESENTATION.md        Your submission. All links, artifacts, and proof go here.
  LEARNING_LOG.md        One short wrap up per skill you learn.
  skills/
    teach-me/SKILL.md       Your learning agent (provided).
    troubleshoot/SKILL.md   Your troubleshooting agent (provided).
  proof/                  Screenshots and other evidence go here.
  docs/
    srs.md                Your Software Requirements Specification.
    system-diagram.drawio Your architecture diagram, created in draw.io.
    requirements.md       Your requirements notes.
    design.md             Your design decisions and the reasoning behind them.
    test-plan.md          Your test plan.
    reflection.md         Your end of project reflection.
  src/                    Your application code goes here.
  tests/                  Your automated tests go here.
  .github/workflows/      Your CI workflow.
  Dockerfile
  .gitignore
  LICENSE
```

## How to Start Building

1. Fork the project repository into your own account.
2. Read this brief in full before writing any code.
3. Work through the relevant items in How to Learn This and the Electives section, using your teach-me skill, and log each one in `LEARNING_LOG.md`.
4. Complete Phase 1 (Requirements and Planning) before touching implementation. This fills in `docs/srs.md`, `docs/system-diagram.drawio`, and `docs/requirements.md`.
5. Build inside the given structure: write your code in `src/`, your tests in `tests/`, and your design decisions in `docs/design.md` as you go.
6. Work in small commits on short lived feature branches, and open at least one real pull request. If something breaks, use your troubleshoot skill before asking your mentor.
7. Confirm a clean clone of your finished repository actually runs from your README alone.

---

## Definition of Done

- [ ] Clean clone runs from the README alone
- [ ] Both sign in methods work: Google and username or email with password
- [ ] Full Users, Workspaces, Projects, Tasks hierarchy implemented with sensible delete behavior
- [ ] Role based permissions enforced server-side, matching the permissions matrix
- [ ] Chat agent can create, update, prioritize, and set reminders on tasks, respecting permissions
- [ ] Real time sync works across at least two open sessions
- [ ] Reminder mechanism sends a real email through Gmail integration
- [ ] Backend works both connected to the frontend and as a standalone token based API
- [ ] Automated test suite passes, with core logic written test-first
- [ ] Test plan document completed
- [ ] Real git history with short lived branches and at least one reviewed pull request
- [ ] One deliberately introduced bug traced and fixed, documented in the reflection
- [ ] SRS, system diagram, requirements, design, and reflection documents all completed
- [ ] `LEARNING_LOG.md` has an entry for every area in Covered Areas
- [ ] `PRESENTATION.md` completed with every link, artifact, and proof of learning
- [ ] Loom video recorded and linked in `PRESENTATION.md`
- [ ] Mentor added as a collaborator on your fork
- [ ] Live presentation call scheduled and completed

---

## Review and Presentation

Once your Definition of Done checklist is complete, submit your work in three formats:

1. **Written.** `PRESENTATION.md` is your submission file. Put everything in it: the live URL, the repository link, the board link, the Loom video link, and a short note on each area you learned, pulled from `LEARNING_LOG.md`.
2. **Video.** Record a short Loom walkthrough of the working app, explaining what it does as you demonstrate it. Add the link to `PRESENTATION.md`.
3. **Live.** Schedule a call with your mentor. Come prepared to walk through the app live (sign in, create a workspace and some tasks, talk to the chat agent, show real time sync across two sessions, show a reminder email arriving) and to answer questions without notes.

---

## Bonus Practice Activities

These are optional unless your mentor points you toward one specifically.

**Daily speaking practice with Gemini Live.** If communication has been flagged as an area to work on, use Gemini's interactive live mode for ten minutes a day while working on this project. Set it up as your instructor with an instruction along these lines:

> You are my speaking coach. Each day I will tell you what I did yesterday, what I accomplished, and what my goal for today is on the AI Task Manager project. Listen to me speak for about ten minutes, then give me clear, honest feedback on my clarity, pace, and confidence, and one specific thing to improve tomorrow.

Follow this simple daily agenda: what you did yesterday, what you accomplished, and what your goal is for today.

**Self recorded review.** Record yourself on camera explaining the project, using any recording app you have available. Watch it back before your live presentation and note filler words, pacing issues, and any explanation that was not as clear as you thought it would be.

---

## Interview Gap-Check Questions

These questions check for real understanding, not just a working app. You should be able to answer all of them comfortably before you consider the project finished.

1. Walk through everything that happens, end to end, from the moment a user types "remind me to call the client tomorrow at 3pm" to the moment the reminder email arrives.
2. Why did you structure the database the way you did? What would break if a Workspace could not contain more than one Project?
3. A Viewer sends a request to delete a task directly to your API, bypassing the interface entirely. Walk through what happens in your code, and why.
4. What is the actual difference between authentication and authorization in your app, and where does each one happen?
5. What guardrails stop your chat agent from doing something a user is not allowed to do?
6. Show a commit or pull request where you caught a real issue through review. What was wrong, and how did you know?
7. Pick one test from your suite. Why does it exist, and was it written before or after the code it tests? Why?
8. Walk through how you found and fixed the deliberately introduced bug: what was the symptom, and how did you narrow down the cause?
9. If two browser tabs are open and a task changes in one, what actually makes the other tab update? What would happen if WebSockets were unavailable?
10. How does your Gmail integration actually send an email? What would you need to change if you switched to a different email provider?
11. What would you do differently if you were starting this project again?

If a resource cannot answer these comfortably, they are assigned a decimal variant of this project, for example Project 1.1: the same skill cluster, a fresh problem, built again until the gap closes.
