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
        id: 'openaugi-status'
      }
    });

    // Create icon
    const iconEl = this.statusBarItem.createEl('span', {
      cls: 'openaugi-status-icon'
    });
    
    // Create loading spinner
    iconEl.createEl('span', {
      cls: 'openaugi-spinner'
    });
    
    // Create text container
    this.statusBarItem.createEl('span', {
      text: message,
      cls: 'openaugi-status-text'
    });
    
    // Create dot animation container
    this.loadingContainer = this.statusBarItem.createEl('span', {
      cls: 'openaugi-loading-dots'
    });
    
    // Create three dots for the animation
    for (let i = 0; i < 3; i++) {
      const dot = this.loadingContainer.createEl('span', {
        text: '.',
        cls: 'openaugi-dot'
      });
      this.dotElements.push(dot);
    }
    
    // Start dot animation
    let currentDot = 0;
    this.animationInterval = window.setInterval(() => {
      // Reset all dots
      this.dotElements.forEach(dot => dot.removeClass('active'));
      
      // Show dots up to current dot
      for (let i = 0; i <= currentDot; i++) {
        this.dotElements[i].addClass('active');
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