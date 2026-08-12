# Project 1 Submission: AI Task Manager

Fill this file in as you go. This is what you submit and what you present from on your call.

## Candidate

- Name: Layth Gharbia
- Date submitted: 07/29

## Links

- Live URL: https://project-1-ai-task-manager-1frontt.onrender.com
- Repository: https://github.com/laythgha/project-1-ai-task-manager/tree/main
- Project board:
- Loom walkthrough video: https://www.loom.com/share/f14bfecd3be8488199d15a86a3ebeabc
 
## Artifacts

- Software Requirements Specification (docs/srs.md): https://github.com/laythgha/project-1-ai-task-manager/blob/main/docs/srs.md
- System diagram (docs/system-diagram.drawio): https://github.com/laythgha/project-1-ai-task-manager/blob/main/docs/Screenshot%202026-07-30%20005115.png
- Test plan (docs/test-plan.md): https://github.com/laythgha/project-1-ai-task-manager/blob/main/docs/test-plan.md
- Permissions matrix, confirmed working (screenshot in proof): https://github.com/laythgha/project-1-ai-task-manager/blob/main/proof/Screenshot%202026-07-30%20010018.png
- Reminder email, confirmed received (screenshot in proof): https://github.com/laythgha/project-1-ai-task-manager/blob/main/proof/image.png
- Real time sync across two sessions (screenshot or short clip in proof): https://www.loom.com/share/3bc7e2aa642c4d639825cf9d8e9d00bc

## Proof of learning

One line per area: what you learned and your confidence from one to three. Pull these from LEARNING_LOG.md.

- Database design: how to organize data 2
- Authentication and authorization: making sure the person is who they are and what they can do 3
- REST API construction: set of urls so other apps can tell it to do things 2
- Prompt engineering and tool calling: practice of structuring your instructions to an LLM 3
- WebSockets and real time sync: connection stays open between server and client 2
- Gmail integration: connecting gmail with OAuth 3
- Test driven development: writing tests that catch bugs 3
- Git workflow and code review: when somebody else looks at the code before it gets pushed 2
- Debugging: a program that is behaving in an unexpected way and finding out the reason 3
 
## Summary

In your own words, a short paragraph on what you built and what you learned. This is what you will walk through on the call.
Built a full stack AI task manager similar to Trello with an AI assistant built in. Users can sign in by creating an account or through their gmail account. You can create workspaces and projects. With those projects you can share tasks to remote teams. Furthermore you can notify members in the workspace about certain tasks. Found a bug where the server was trusting information sent by the user instead of checking the data and fixed that so someone couldn't edit data. That shows to always verify by checking the database. Also learned alot about deployment getting, obviously having something local host is different than having it live.
