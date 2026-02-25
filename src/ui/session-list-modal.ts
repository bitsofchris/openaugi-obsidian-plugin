import { App, Modal, Setting } from 'obsidian';
import { TaskSession } from '../types/task-dispatch';

export class SessionListModal extends Modal {
  private sessions: TaskSession[];
  private onAttach: (session: TaskSession) => void;
  private onKill: (session: TaskSession) => void;

  constructor(
    app: App,
    sessions: TaskSession[],
    onAttach: (session: TaskSession) => void,
    onKill: (session: TaskSession) => void
  ) {
    super(app);
    this.sessions = sessions;
    this.onAttach = onAttach;
    this.onKill = onKill;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Active Task Sessions' });

    if (this.sessions.length === 0) {
      contentEl.createEl('p', { text: 'No active task sessions found.' });
      new Setting(contentEl)
        .addButton(button => button
          .setButtonText('Close')
          .onClick(() => this.close())
        );
      return;
    }

    for (const session of this.sessions) {
      const elapsed = this.formatElapsed(session.startedAt);

      new Setting(contentEl)
        .setName(session.taskId)
        .setDesc(`Started ${elapsed}`)
        .addButton(button => button
          .setButtonText('Attach')
          .setCta()
          .onClick(() => {
            this.onAttach(session);
            this.close();
          })
        )
        .addButton(button => button
          .setButtonText('Kill')
          .setWarning()
          .onClick(() => {
            this.onKill(session);
            this.close();
          })
        );
    }

    new Setting(contentEl)
      .addButton(button => button
        .setButtonText('Close')
        .onClick(() => this.close())
      );
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private formatElapsed(isoTimestamp: string): string {
    if (isoTimestamp === 'unknown') return 'unknown';
    const ms = Date.now() - new Date(isoTimestamp).getTime();
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
}
