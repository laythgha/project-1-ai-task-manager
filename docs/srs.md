# Software Requirements Specification (SRS)

## 1. Introduction

### 1.1 Purpose
[What this document describes and who it is for]


This SRS document will describe the requirements needed for this task manager for team members.
### 1.2 Scope
[What the product does, in a short paragraph]

Lets team members be coordinated and organized their work and projects with role based permissions and an AI chat bot that will help with organizaing users tasks.

### 1.3 Definitions and Terms
[Any terms a reader would need explained]

RBAC- Role based access control - assiging permissions to users
Authentication - checking who the user is
Authorization - What a user is allowed to do
Hashing - scrambling passwords

## 2. Overall Description

### 2.1 Product Perspective
[How this product fits into a wider context, if any]

There are other similar apps just as Trello.
### 2.2 User Classes and Characteristics

[Who uses this product and how]
Team members who work remotely or need to be more organized. They use it as an application on their phone or their comptuer or use it on their browser.
### 2.3 Assumptions and Constraints

[Anything assumed to be true, and any limits on the solution]
That there are reminders
That there is a chatbot
One constraint is using google to sign in
## 3. Specific Requirements

### 3.1 Functional Requirements

[Numbered list of what the system must do]

The app must allow the user to sign in using Google or their email and password.

The app must allow the user to create a workspace.

The app must allow the user to join a workspace.

The app must allow a user with Editor role to edit the workspace.

The app must allow a user with Viewer role to only view the workspace.

The app must allow a user with Admin role to delete the workspace.

The app must allow a user with Admin role to add users.

The app must allow the user to create projects in the workspace.

The app must allow the user to create tasks in the project.

The app must allow the user to edit tasks.

The app must allow the user to prioritize tasks.

The app must allow the user to create reminders.

The app must allow the user to access the chatbot.

The app must make the chatbot have the same permissions and guardrails as the user.

The app must notify the user about reminders through their Gmail.

The app must update anything the user adds or deletes in real time.


### 3.2 Non-Functional Requirements
[Performance, security, usability, and similar expectations]

The request must load in under a second

### 3.3 External Interface Requirements
[Any APIs, third-party services, or integrations this system depends on]

Google: Logging in
Claude: Chatbot
## 4. Appendices

[Anything else worth recording]
