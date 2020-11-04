import { Component } from '@angular/core';
import { first } from 'rxjs/operators';

import { User } from '../models';
import { AuthenticationService } from '../services';

@Component({ templateUrl: 'home.component.html' })
export class HomeComponent {
    loading = false;
    user: User;
    userFromApi: User;

    constructor(private authenticationService: AuthenticationService ) { 
        this.user = this.authenticationService.userValue;
    }

    ngOnInit() {
        this.loading = true;
        this.authenticationService.getById(this.user.id).pipe(first()).subscribe(user => {
            this.loading = false;
            this.userFromApi = user;
        });
    }
    
}