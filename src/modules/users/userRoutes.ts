import { FastifyInstance } from "fastify";
import { Login, Signup, forgotPassword, getUserSessionsHandler, googleOauthHandler, healthCheckup, logoutHandler, resetPassword } from "./userController";
import { authenticate } from "../../utils/jwtVerifty";
import { $ref } from "./userSchema";

async function userRoutes(server: FastifyInstance) {
    // server.get("/healthCheck", {}, healthCheckup)
    server.get("/healthCheck", {}, healthCheckup)
    server.post("/login", {}, Login);
    server.delete("/logout",
        {
            onRequest: [authenticate]
        },
        logoutHandler)
    server.post("/signup", {}, Signup)
    server.post("/forgotPassword", {
        schema: {
            body: $ref('forgotPasswordSchema')
        }
    }, forgotPassword);
    server.get("/passwordForm", (request, reply) => {
        reply.view("./views/passwordReset.ejs", { data: "Hello" })
    })
    server.patch("/resetPassword/:token", resetPassword);
    server.get("/google", {}, googleOauthHandler)
    server.get("/sessions",
        {
            onRequest: [authenticate]
        }
        , getUserSessionsHandler)
}

export default userRoutes;