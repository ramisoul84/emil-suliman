import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, output, signal, untracked } from '@angular/core';
import { Message } from '../../../_models/message';
import { MessageService } from '../../../_services/message.service';
import { flag, place } from '../ui/format';

const PAGE_SIZE = 20;

/** The contact-form inbox: list on the left, the open message on the right. */
@Component({
  selector: 'app-admin-messages',
  imports: [DatePipe],
  templateUrl: './messages.html',
  styleUrl: './messages.scss',
})
export class Messages {
  private readonly api = inject(MessageService);

  /** Tells the shell the new unread count (for the tab badge). */
  readonly unreadChange = output<number>();

  readonly messages = signal<Message[]>([]);
  readonly total = signal(0);
  readonly unread = signal(0);
  readonly page = signal(0);
  readonly unreadOnly = signal(false);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly openId = signal<number | null>(null);
  readonly confirmDelete = signal(false);
  readonly busy = signal(false);

  readonly open = computed(() => this.messages().find((m) => m.id === this.openId()) ?? null);
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));
  readonly flag = flag;
  readonly place = place;

  constructor() {
    effect(() => {
      this.page();
      this.unreadOnly();
      untracked(() => this.load());
    });
  }

  setFilter(unreadOnly: boolean): void {
    this.page.set(0);
    this.unreadOnly.set(unreadOnly);
  }

  load(): void {
    this.loading.set(true);
    this.api.getList(PAGE_SIZE, this.page() * PAGE_SIZE, this.unreadOnly()).subscribe({
      next: (list) => {
        this.messages.set(list.messages);
        this.total.set(list.total);
        this.setUnread(list.unread);
        this.error.set(null);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(describe(err));
        this.loading.set(false);
      },
    });
  }

  select(m: Message): void {
    this.openId.set(m.id);
    this.confirmDelete.set(false);
    if (m.unread) this.markUnread(m, false);
  }

  close(): void {
    this.openId.set(null);
    this.confirmDelete.set(false);
  }

  markUnread(m: Message, unread: boolean): void {
    this.patch(m.id, { unread });
    this.setUnread(this.unread() + (unread ? 1 : -1));
    this.api.setUnread(m.id, unread).subscribe({
      error: (err) => {
        // put it back as it was
        this.patch(m.id, { unread: !unread });
        this.setUnread(this.unread() + (unread ? -1 : 1));
        this.error.set(describe(err));
      },
    });
  }

  remove(m: Message): void {
    this.busy.set(true);
    this.api.deleteMessage(m.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.close();
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(describe(err));
      },
    });
  }

  replyLink(m: Message): string {
    const subject = m.site_language === 'de' ? 'Ihre Nachricht an Emil Suliman' : 'Your message to Emil Suliman';
    return `mailto:${m.email}?subject=${encodeURIComponent(subject)}`;
  }

  preview(text: string): string {
    const line = text.replace(/\s+/g, ' ').trim();
    return line.length > 110 ? `${line.slice(0, 109)}…` : line;
  }

  private patch(id: number, change: Partial<Message>): void {
    this.messages.update((list) => list.map((m) => (m.id === id ? { ...m, ...change } : m)));
  }

  private setUnread(n: number): void {
    this.unread.set(Math.max(0, n));
    this.unreadChange.emit(this.unread());
  }
}

function describe(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'Cannot reach the server.';
    if (err.status === 404) return 'That message no longer exists.';
    return err.error?.error?.message ?? `Request failed (${err.status}).`;
  }
  return 'Unexpected error.';
}
