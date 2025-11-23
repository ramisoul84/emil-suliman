import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Message } from '../../models/message';
import { Subscription } from 'rxjs';
import { Visitor } from '../../models/visitor';

@Component({
  selector: 'app-admin',
  imports: [CommonModule, ReactiveFormsModule],
  providers: [ApiService],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit, OnDestroy {
  loginForm: FormGroup;
  selectedMessage: Message | null = null;
  errMsg: string = ""

  isLoggedin = true
  loading: boolean = false;
  authSubscription!: Subscription;


  messages: Message[] = [];
  visitors: Visitor[] = [];

  totalVisitors:number=0;
  uniqueVisitors:number=0;

  // Pagination
  limit = 10;
  offset = 0;
  total = 0;
  currentPage = 1;
  totalPages = 0;
  hasMore = false;


  constructor(private fb: FormBuilder, public api: ApiService) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  ngOnInit(): void {
    this.authSubscription = this.api.isAuthenticated().subscribe(
      isAuthenticated => {
        if (isAuthenticated) {
          this.loadMessages();
          this.loadVisitors();
        }
      }
    );
  }

  ngOnDestroy() {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  onSubmit() {
    if (this.loginForm.valid) {
      this.loading = true;
      const { email, password } = this.loginForm.value;

      this.api.login(email, password).subscribe({
        next: () => {
          this.loading = false;
          this.loadMessages();
        },
        error: (error) => {
          this.errMsg = "Invalid Credentials"
          setTimeout(() => {
            this.errMsg = ""
          }, 1000)
          this.loading = false;

        }
      });
    }
  }

  logout() {
    this.api.logout();
    this.messages = [];
  }

  loadMessages() {
    this.loading = true;
    this.api.getList(this.limit, this.offset).subscribe({
      next: (response) => {
        this.messages = response.messages;
        this.total = response.total;
        this.totalPages = Math.ceil(response.total / this.limit)
        this.hasMore = (this.offset + this.limit) < this.total;
        this.loading = false;
      },
      error: (error) => {
        console.error('Failed to load messages:', error);
        this.loading = false;
        if (error.status === 401) {
          this.api.logout();
        }
      }
    });
  }

  loadNext() {
    this.offset += this.limit;
    this.currentPage++;
    this.loadMessages();
  }

  loadPrevious() {
    this.offset = Math.max(0, this.offset - this.limit);
    this.currentPage = Math.max(1, this.currentPage - 1);
    this.loadMessages();
  }

  markAsRead(id: string) {
    this.api.markMessageAsRead(id).subscribe()
  }

  deleteMessage(id: string) {
    this.api.deleteMessage(id).subscribe({
      next: () => {
        this.selectedMessage = null;
        this.loadMessages()
      }
    })

  }

  selectMessage(message: Message) {
    this.selectedMessage = message;

    if (message.unread) {
      this.markAsRead(message.id);
    }
  }

  closeDetails() {
    this.selectedMessage = null;
    this.loadMessages();
  }

  loadVisitors() {
    this.loading = true;
    this.api.getVisitors().subscribe({
      next: (response) => {
        this.visitors = response.visitors
        this.totalVisitors = response.total;
        this,this.uniqueVisitors = response.unique;
      },
      error: (error) => {
        console.error('Failed to load visitors:', error);

      }
    });
  }
}
