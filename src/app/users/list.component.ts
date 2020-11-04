import { Component, OnInit } from '@angular/core';
import { first } from 'rxjs/operators';

import { AuthenticationService } from '../services';

@Component({ templateUrl: 'list.component.html' })
export class ListComponent implements OnInit {
    users = null;
    loading = false;

    constructor(private authenticationService: AuthenticationService) {}

    ngOnInit() {
        this.loading = true;
        this.authenticationService.getAll()
            .pipe(first())
            .subscribe(users => {
                this.users = users;
                this.loading = false;
            });
    }

    deleteUser(id: string) {
        const user = this.users.find(x => x.id === id);
        user.isDeleting = true;
        this.authenticationService.delete(id)
            .pipe(first())
            .subscribe(() => this.users = this.users.filter(x => x.id !== id));
    }
}