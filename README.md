# OpenAugi
## Voice to Self-Organizing Second Brain for Obsidian

Unlock the power of voice capture and go faster.

Open Augi ("auggie") is an open source augmented intelligence plugin for Obsidian. It's designed for people who like to think out loud (like me).

Just capture your voice note, drop hints to Augi, and let Open Augi's agentic workflow process your note into a self-organizing second brain for you.

This is designed to run in a separate folder within your vault. Any agentic actions taken on existing notes, not created by Augi, will be sent to you for review.

Let Open Augi process and organize your thoughts so you can go further, faster.

Join the [Discord](https://discord.gg/d26BVBrnRP).
Parent [repo](https://github.com/bitsofchris/openaugi).


## Example

When taking a voice note say "auggie this is a task" or "auggie make a new note about X". 

Import your voice transcript into Obsidian.

Hit `CMD+P` and run the `OpenAugi: Parse Transcript` command.

This will create:
- atomic notes for every idea in your transcript
- extract tasks
- summarize the entire voice note

The summary note will be created with any relevant tasks and links to the new atomic notes.

## Requirements
Note: this requires an OpenAI API key to work. 

Your transcript is sent directly to OpenAI for parsing using the best model for this task. The cost to use this plugin depends on the API credits consumed. For me ~5 minutes of voice note is about 2-3 cents of processing.


# Get involved, let's build augmented intelligence

This plugin is meant to solve my own problems around using Obsidian as my second brain and AI for organizing my notes.

Augmented intelligence is using AI to help you think faster and do more. Not to write and think for you. But rather to support and augment what you are capable of.

Open an [issue](https://github.com/bitsofchris/openaugi-obsidian-plugin/issues), join the [Discord](https://discord.gg/d26BVBrnRP), and check out my [YouTube](https://www.youtube.com/@bitsofchris) to give feedback on how this works for you or what you'd like to see next.