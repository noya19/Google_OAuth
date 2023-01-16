import { FastifyRequest, FastifyReply } from "fastify";
import crypto from 'node:crypto';
import { createUser, findUserbyEmail, findUserbyHash, getGoogleOAuthTokens, getGoogleUser, setNewPassword, updateHashedPassword, upsertUser } from "./userServices";
import { CreateUserInput, LoginUserInput, forgotPassword } from "./userSchema";
import { server } from "../../app";
import { createSession, deleteSession, findSessions, updateSession } from "./sessionService";
import { createPasswordResetToken } from "../../utils/forgotpassword";
import { sendEmail } from "../../utils/emailSender";

type query = {
    code: string
}

const accessTokenCookieOptions: any = {
    maxAge: 900000, // 15 mins
    httpOnly: true,
    domain: "localhost",
    path: "/",
    sameSite: "lax",
    secure: false,
};

const refreshTokenCookieOptions: any = {
    ...accessTokenCookieOptions,
    maxAge: 3.154e10, // 1 year
};


export async function healthCheckup(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body;
    console.log("Hello")
    return reply.code(200).send({ message: "This is a test endpoint" })
}

export async function Login(request: FastifyRequest<{ Body: LoginUserInput }>, reply: FastifyReply) {

    // Validate the user's password
    const { email, password: candidatePassword } = request.body;
    const user = await findUserbyEmail(email);

    if (!user) {
        return reply.code(401).send({
            message: "Invalid username or password",
        });
    }

    const match = await server.bcrypt.compare(candidatePassword, user.password);
    if (!match) {
        return reply.code(401).send({ message: "Invalid username or password" });
    }

    // create a session
    const session = await createSession(user.id, request.headers["user-agent"] || "")


    // create an access token
    const { password, ...rest } = user;
    const payload = { ...rest, sessionId: session.id }
    const accessToken = server.jwt.sign(payload, { expiresIn: process.env.ACCESSTOKEN_TTL })


    // create a refresh token
    const refreshToken = server.jwt.sign(payload, { expiresIn: process.env.REFRESHTOKEN_TTL })

    // set cookies
    reply.setCookie('accessToken', accessToken, accessTokenCookieOptions);
    reply.setCookie('refreshToken', refreshToken, refreshTokenCookieOptions);

    // return access token and refresh token.
    return reply.code(200).send({
        accessToken, refreshToken
    })

}

export async function Signup(request: FastifyRequest<{ Body: CreateUserInput }>, reply: FastifyReply) {
    const body = request.body;
    try {
        // create a user
        const user = await createUser(body);

        // create a session
        const session = await createSession(user.id, request.headers["user-agent"] || "")


        // create an access token
        const { password, ...rest } = user;
        const payload = { ...rest, sessionId: session.id }
        const accessToken = server.jwt.sign(payload, { expiresIn: process.env.ACCESSTOKEN_TTL })


        // create a refresh token
        const refreshToken = server.jwt.sign(payload, { expiresIn: process.env.REFRESHTOKEN_TTL })

        // set cookies
        reply.setCookie('accessToken', accessToken, accessTokenCookieOptions);
        reply.setCookie('refreshToken', refreshToken, refreshTokenCookieOptions);

        // return access token and refresh token.
        return reply.code(200).send({
            accessToken,
            refreshToken,
            message: "User Created Successfully"
        })

    } catch (e) {
        console.error(e);
        return reply.code(500).send("Something went wrong")
    }
}

export async function googleOauthHandler(request: FastifyRequest<{ Querystring: query }>, reply: FastifyReply) {
    // get the code from the querystring
    const code = request.query.code;

    try {
        // get the ID and access token with the code
        const { id_token, access_token } = await getGoogleOAuthTokens({ code });
        console.log({
            id: id_token,
            token: access_token
        })

        // get the user with tokens
        // Note there are two ways to do this:
        // 1. make a request to google server( network request ) to get authenticated and also get user data

        // know about the difference between id_token and access_token------here(https://stackoverflow.com/questions/13875366/what-is-id-token-google-oauth#:~:text=The%20id_token%20is%20used%20in,information%20about%20the%20user's%20authentication.)
        const googleUser = await getGoogleUser(id_token, access_token);

        // 2. Just decode the id_token sent by google. ( but you might have to verify it before decoding)
        // server.jwt.decode(id_token);

        console.log("The google User", { googleUser });

        if (!googleUser.verified_email) {
            return reply.code(403).send({ message: 'Google Account is not Verified' });
        }

        // upsert the user
        const user = await upsertUser(googleUser);

        // create a session
        const session = await createSession(user.id, request.headers["user-agent"] || "")

        const { password, ...rest } = user;
        const payload = { ...rest, sessionId: session.id }
        const accessToken = server.jwt.sign(payload, { expiresIn: process.env.ACCESSTOKEN_TTL })


        // create a refresh token
        const refreshToken = server.jwt.sign(payload, { expiresIn: process.env.REFRESHTOKEN_TTL })

        // set cookies
        reply.setCookie('accessToken', accessToken, accessTokenCookieOptions);
        reply.setCookie('refreshToken', refreshToken, refreshTokenCookieOptions);


        // redirect back to the client.
        return reply.code(200).send({ "access_token": access_token })

    } catch (e) {
        console.log("This is the error", e);
        return;
    }
}

export async function getUserSessionsHandler(request: FastifyRequest, reply: FastifyReply) {
    const userID = request.user.id;
    const sessions = await findSessions({ userId: userID, valid: true });
    return reply.code(200).send(sessions);

}

export async function logoutHandler(request: FastifyRequest, reply: FastifyReply) {
    const sessionId = request.user.sessionId;
    // console.log(sessionId);

    await deleteSession({ id: sessionId, valid: false })

    return reply.code(200).send({
        accessToken: null,
        refreshToken: null
    })
}

export async function forgotPassword(request: FastifyRequest<{ Body: forgotPassword }>, reply: FastifyReply) {
    //1. Get user based on posted email.
    const email = request.body.email;
    const user = await findUserbyEmail(email);
    if (!user) {
        return reply.code(404).send({
            message: "No user with this email found"
        })
    }

    //2. Generate the random token.
    const { resetToken, resetTokenHashed } = await createPasswordResetToken();

    //3. Save hashedToken and PasswordResetExpiredIn in the database.
    await updateHashedPassword(user.id, resetTokenHashed)

    //4. Send it to the User's email.
    const resetURL = `${request.protocol}://${request.hostname}/api/users/resetPassword/:${resetToken}`;
    const message = `Forgot your password? Submit a patch request with your new password and passwordConfirm to: ${resetURL}.\n If you didn't forget your password, please ignore this email.`

    try {
        await sendEmail({
            to: user.email,
            subject: 'Your password reset token (valid for 10 mins )',
            message
        });

        return reply.code(200).send({
            status: "success",
            message: "Token sent to email!"
        });

    } catch (e) {
        // In case of an error reset the resetToken and resetHashedToken to undefined or null.
        console.log(e);
        await updateHashedPassword(user.id, null);
        return reply.code(500).send({
            message: "There was an Error, please try again later."
        })
    }

}

export async function resetPassword(request: FastifyRequest<{ Params: { token: string }, Body: { password: string } }>, reply: FastifyReply) {
    try {
        //1. Get the user based on the token
        const resetToken = request.params.token;
        const resetTokenHashed = crypto.createHash('sha256').update(resetToken).digest('hex');


        const user = await findUserbyHash(resetTokenHashed);

        if (!user) {
            console.log("No User based on the hased Token")
            return reply.send(500).send({
                message: "something went wrong"
            })
        }

        const dateNow = Date.now();
        const expirationDate = user.passwordResetExpires?.getTime() as number;
        if (dateNow > expirationDate) {
            console.log("Expired")
            return reply.send(500).send({
                message: "something went wrong"
            })
        }

        //2. If the token has not expired and there is a user, set the new password
        const password = request.body.password;
        const hashedPassword = await server.bcrypt.hash(password);

        await setNewPassword(user.id, hashedPassword);

        return reply.code(200).send({
            message: "The password has been set Successfully"
        })

    } catch (e) {
        console.log(e);
        return reply.code(500).send({
            message: "Something went wrong, try again later."
        })
    }
}