import { WorkspaceLeaf } from 'obsidian';

/**
 * Modal loading indicator that shows processing status
 */
export class LoadingIndicator {
  private statusBarItem: HTMLElement | null = null;
  private loadingContainer: HTMLElement | null = null;
  private dotElements: HTMLElement[] = [];
  private animationInterval: number | null = null;
  private statusBar: HTMLElement;

  constructor(statusBar: HTMLElement) {
    this.statusBar = statusBar;
  }

  /**
   * Show the loading indicator with a message
   * @param message The message to display
   */
  show(message: string): void {
    this.hide(); // Clear any existing indicators first
    
    // Create status bar item
    this.statusBarItem = this.statusBar.createEl('div', {
      cls: 'status-bar-item mod-clickable',
      attr: {
        id: 'openaugi-status',
        style: 'display: flex; align-items: center; gap: 8px; color: var(--text-accent);'
      }
    });

    // Create icon
    const iconEl = this.statusBarItem.createEl('span', {
      cls: 'status-bar-item-icon',
      attr: {
        style: 'display: flex; align-items: center;'
      }
    });
    
    // Create loading spinner
    const spinner = iconEl.createEl('span', {
      cls: 'openaugi-spinner',
      attr: {
        style: `
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid var(--text-accent);
          border-radius: 50%;
          border-top-color: transparent;
          animation: openaugi-spin 1s linear infinite;
        `
      }
    });
    
    // Add CSS animation
    const styleEl = document.head.createEl('style');
    styleEl.textContent = `
      @keyframes openaugi-spin {
        to {
          transform: rotate(360deg);
        }
      }
    `;
    
    // Create text container
    const textEl = this.statusBarItem.createEl('span', {
      text: message,
      attr: {
        style: 'font-size: 13px; font-weight: 500;'
      }
    });
    
    // Create dot animation container
    this.loadingContainer = this.statusBarItem.createEl('span', {
      attr: { style: 'display: flex; gap: 2px;' }
    });
    
    // Create three dots for the animation
    for (let i = 0; i < 3; i++) {
      const dot = this.loadingContainer.createEl('span', {
        text: '.',
        attr: {
          style: 'opacity: 0; transition: opacity 0.3s ease; font-weight: bold;'
        }
      });
      this.dotElements.push(dot);
    }
    
    // Start dot animation
    let currentDot = 0;
    this.animationInterval = window.setInterval(() => {
      // Reset all dots
      this.dotElements.forEach(dot => dot.style.opacity = '0');
      
      // Show dots up to current dot
      for (let i = 0; i <= currentDot; i++) {
        this.dotElements[i].style.opacity = '1';
      }
      
      // Increment and wrap around
      currentDot = (currentDot + 1) % this.dotElements.length;
    }, 500);
  }

  /**
   * Hide the loading indicator
   */
  hide(): void {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }
    
    if (this.statusBarItem) {
      this.statusBarItem.remove();
      this.statusBarItem = null;
    }
    
    this.dotElements = [];
    this.loadingContainer = null;
  }
} 