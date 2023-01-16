import Fastify, { FastifyReply, FastifyRequest } from "fastify";
import userRoutes from "./modules/users/userRoutes";
import fastifyBcrypt from "fastify-bcrypt";
import fastifyJwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";
import { userSchemas } from "./modules/users/userSchema";

require('dotenv').config();

export const server = Fastify();

//View Engine registered to the reply object
server.register(require("@fastify/view"), {
  engine: { ejs: require('ejs') },
  propertyName: "view"
});


declare module "fastify" {
  interface FastifyReply {
    view: any
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    user: {
      id: string;
      name: string;
      role: string;
      email: string;
      sessionId: string;
    };
  }
}

// register the jwt package and define the secret.
server.register(fastifyJwt, {
  secret: process.env.JWT_SECRET as string
});



// register bcrypt
server.register(fastifyBcrypt, {
  saltWorkFactor: Number(process.env.SALT),
});


// register fastify cookie
server.register(fastifyCookie, {
  hook: 'onRequest',
})

declare module 'fastify' {
  interface FastifyInstance {
    nodemailer: any,

  }
}

// register nodemailer
server.register(require('fastify-nodemailer'), {
  pool: true,
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
})

async function start() {

  await server.register(userRoutes, { prefix: "api/users" });

  for (const schema of userSchemas) {
    server.addSchema(schema);
  }


  try {
    await server.listen({ port: 3000, host: "0.0.0.0" }, (err, address) => {
      console.log(err);
      console.log(`Server listening to ${address}`);
    });
    // console.log(`Server Listening to http://localhost:3000`);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

start();