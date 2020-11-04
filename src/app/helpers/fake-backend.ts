import { Injectable } from '@angular/core';
import { HttpRequest, HttpResponse, HttpHandler, HttpEvent, HttpInterceptor, HTTP_INTERCEPTORS } from '@angular/common/http';
import { Observable, of, throwError, from } from 'rxjs';
import { delay, materialize, dematerialize, concatMap } from 'rxjs/operators';
import { Role } from '../models';

//const users: User[] = [{ id: 1, username: 'ramona', password: 'password', firstName: 'Ramona', lastName: 'Vacarasu' }];
const usersKey = 'registration-login';
//let users = JSON.parse(localStorage.getItem(usersKey)) || [];

let users = [
    { id: 1, username: 'Ramona', password: 'Ramona', firstName: 'Ramona', lastName: 'Vacarasu', extraInfo: 'Some info', role: Role.Admin },
    { id: 2, username: 'Raluca', password: 'Raluca', firstName: 'Raluca', lastName: 'Vacarasu', extraInfo: 'Some info', role: Role.User },
    { id: 3, username: 'Bogdan', password: 'Bogdan', firstName: 'Bogdan', lastName: 'Enache', extraInfo: 'Some info about Bogdan', role: Role.User },
];

@Injectable()
export class FakeBackendInterceptor implements HttpInterceptor {
    intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

        const { url, method, headers, body } = request;

        return handleRoute();

        function handleRoute() {
            switch (true) {
                case url.endsWith('/users/authenticate') && method === 'POST':
                    return authenticate();
                case url.endsWith('/users/authenticatefb') && method === 'POST':
                    return authenticateWithFb();
                case url.endsWith('/users/register') && method === 'POST':
                    return register();
                case url.endsWith('/users') && method === 'GET':
                    return getUsers();
                case url.match(/\/users\/d+$/) && method === 'GET':
                    return getUserById();
                case url.match(/\/users\/d+$/) && method === 'PUT':
                    return updateUser();
                case url.match(/\/users\/d+$/) && method === 'DELETE':
                    return deleteUser();
                default:
                    // pass through any requests not handled above
                    return next.handle(request);
            }    
        }

        // authenticate with facebook

        function authenticateWithFb() {
            const { accessToken } = body;

            return from(new Promise(resolve => {
                fetch(`https://graph.facebook.com/v8.0/me?access_token=${accessToken}`)
                    .then(response => resolve(response.json()));
            })).pipe(concatMap((data: any) => {
                if (data.error) return unauthorized(data.error.message);

                let user = users.find(x => x.username === data.id);

                if (!user) {

                    let fullName = data.name;
                    let partsName = fullName.split(' ');

                    // create new user if first time logging in
                    user = {
                        id: users.length ? Math.max(...users.map(x => x.id)) + 1 : 1,
                        username: data.id,
                        password: data.password,
                        firstName: partsName[0],
                        lastName: partsName[1],
                        extraInfo: `This is some extra info about ${fullName} that is saved in the API: ${data.extraInfo}`,
                        role: Role.User
                    }
                    users.push(user);
                    localStorage.setItem(usersKey, JSON.stringify(users));
                }

                return ok({
                    ...user,
                    token: generateJwtToken(user)
                });
            }));
        }

      
        function generateJwtToken(account) {
            // create token that expires in 15 minutes
            const tokenPayload = { 
                exp: Math.round(new Date(Date.now() + 15*60*1000).getTime() / 1000),
                id: account.id
            }
            return `fake-jwt-token.${btoa(JSON.stringify(tokenPayload))}`;
        }

        
        // route functions

        function authenticate() {
            const { username, password } = body;
            const user = users.find(x => x.username === username && x.password === password);
            if (!user) return error('Username or password is incorrect');
            return ok({
                id: user.id,
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                extraInfo: user.extraInfo,
                role: user.role,
               // ...basicDetails(user),
                token: `fake-jwt-token.${user.id}`
            })
        }

        function register() {

            const user = body;

            if (users.find(x => x.username === user.username)) {
                return  error('Username "' + user.username + '" is already taken')
            }

            user.id = users.length ? Math.max(...users.map(x => x.id)) + 1 : 1;
            user.role = Role.User;
            user.extraInfo = 'Some info about ' + user.username + ' .'
            users.push(user);
            localStorage.setItem(usersKey, JSON.stringify(users));
            return ok();
        }


        function getUsers() {
            //if (!isLoggedIn()) return unauthorized();
            if (!isAdmin()) return unauthorized();
            return ok(users);
        }

        function getUserById() {
            if (!isLoggedIn()) return unauthorized();

            // only admins can access other user records
            if (!isAdmin() && currentUser().id !== idFromUrl()) return unauthorized();

            let user = users.find(x => x.id === idFromUrl());
            return ok(user);

        }

        function updateUser() {
            if (!isLoggedIn()) return unauthorized();

            let params = body;
            let user = users.find(x => x.id === idFromUrl());

            // only update password if entered
            if (!params.password) {
                delete params.password;
            }

            // update and save user
            Object.assign(user, params);
            localStorage.setItem(usersKey, JSON.stringify(users));

            return ok();
        }

        function deleteUser() {
            if (!isLoggedIn()) return unauthorized();

            users = users.filter(x => x.id !== idFromUrl());
            localStorage.setItem(usersKey, JSON.stringify(users));
            return ok();
        }

        // helper functions

        function ok(body?) {
            return of(new HttpResponse({ status: 200, body }))
            .pipe(delay(500)); // delay observable to simulate server api call
        }

        function unauthorized(message = 'Unauthorized') {
            return throwError({ status: 401, error: { message: 'Unauthorised' } })
                .pipe(materialize(), delay(500), dematerialize()); // call materialize and dematerialize to ensure delay even if an error is thrown (https://github.com/Reactive-Extensions/RxJS/issues/648);
        }

        function error(message) {
            return throwError({ status: 400, error: { message } })
                .pipe(materialize(), delay(500), dematerialize());
        }

        function isLoggedIn() {
            //return headers.get('Authorization') === `Basic ${window.btoa('ramona:password')}`;
            return headers.get('Authorization')?.startsWith('Bearer fake-jwt-token');
        }

        function isAdmin() {
            return isLoggedIn() && currentUser().role === Role.Admin;
        }

        function currentUser() {
            if (!isLoggedIn()) return;
            const id = parseInt(headers.get('Authorization').split('.')[1]);
            return users.find(x => x.id === id)
        }

        function idFromUrl() {
            const urlParts = url.split('/');
            return parseInt(urlParts[urlParts.length - 1]);
        }
    }
}

export let fakeBackendProvider = {
    // use fake backend in place of Http service for backend-less development
    provide: HTTP_INTERCEPTORS,
    useClass: FakeBackendInterceptor,
    multi: true
};