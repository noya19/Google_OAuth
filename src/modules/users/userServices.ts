import { server } from "../../app";
// import { gapi_creds } from "../../utils/googleOauth";
import prisma from "../../utils/prisma";
import { CreateUserInput } from "./userSchema";
import axios from "axios";
import qs from 'qs';
import ps from 'generate-password';

export async function findUserbyEmail(email: string) {
    return prisma.user.findUnique({
        where: {
            email: email,
        },
        select: {
            id: true,
            name: true,
            role: true,
            email: true,
            password: true,
            picture: true
        }
    })
}

export async function findUserbyID(id: string) {
    return prisma.user.findUnique({
        where: {
            id: id,
        }
    })
}

export async function createUser(data: CreateUserInput) {
    // Get data
    const { password, ...rest } = data;

    // Hash the password
    const securePassword = await server.bcrypt.hash(password);

    // Create the new user using the secure(Hashed Password)
    const user = await prisma.user.create({
        data: { ...rest, password: securePassword },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            password: true,
            picture: true,
        }
    });

    return user;
}

interface GoogleTokenResult {
    access_token: string,
    expires_in: string,
    refresh_token: string,
    scope: string,
    id_token: string
}

export async function getGoogleOAuthTokens({ code }: { code: string }): Promise<GoogleTokenResult> {
    const url = 'https://oauth2.googleapis.com/token';
    const values = {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI,
        grant_type: "authorization_code"
    }

    try {
        const res = await axios.post<GoogleTokenResult>(url, qs.stringify(values),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                }
            })

        return res.data;
    } catch (error: any) {
        console.log(error, "Failed to fetch Google OAuth tokens")
        throw new Error(error);
    }
}

interface GoogleUserResult {
    id: string;
    email: string;
    verified_email: boolean;
    name: string;
    given_name: string;
    family_name: string;
    picture: string;
    locale: string;
}

export async function getGoogleUser(id_token: string, access_token: string): Promise<GoogleUserResult> {
    try {
        const res = await axios.get<GoogleUserResult>(`https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${access_token}`,
            {
                headers: {
                    Authorization: `Bearer ${id_token}`
                }
            }
        )
        return res.data;
    } catch (e: any) {
        console.log("Error Fetching Google User", e);
        throw new Error(e);
    }
}

export async function createPasswordGoogleOauth() {
    const password = ps.generate({
        length: 8,
        strict: true,
    });
    const securePassword = await server.bcrypt.hash(password);
    return securePassword;
}

export async function upsertUser(data: GoogleUserResult) {
    const upsertUser = await prisma.user.upsert({
        where: {
            email: data.email,
        },
        update: {
            name: data.name,
        },
        create: {
            name: data.name,
            email: data.email,
            password: await createPasswordGoogleOauth(),
            picture: data.picture,
        }
    })

    return upsertUser;
}

export async function updateHashedPassword(userID: string, resetTokenHashed: string | null) {
    //1. Take now + 10 mins ( convert into miliseconds) --> the token is valid for 10 misn
    const date = Date.now() + 10 * 60 * 1000;

    //2. create a date with the above miliseconds and also convert it into UTC format.
    const resetExpiredIn = new Date(date);

    //3. make the changes.
    return await prisma.user.update({
        where: {
            id: userID
        },
        data: {
            passwordResetToken: resetTokenHashed,
            passwordResetExpires: resetExpiredIn
        }
    })
}

export async function findUserbyHash(hash: string) {
    return await prisma.user.findUnique({
        where: {
            passwordResetToken: hash
        },
        select: {
            id: true,
            passwordResetExpires: true
        }
    })
}

export async function setNewPassword(user_id: string, password: string) {
    return await prisma.user.update({
        where: {
            id: user_id
        },
        data: {
            password: password,
            passwordResetToken: null,
            passwordResetExpires: null
        }
    })
}