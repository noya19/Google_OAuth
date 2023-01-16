import { FastifyReply, FastifyRequest } from "fastify";
import { server } from "../app";
import { findSession, updateSession } from "../modules/users/sessionService";
import { findUserbyEmail, findUserbyID } from "../modules/users/userServices";

export interface decodedJwt {
      id: string;
      name: string;
      role: string;
      email: string;
      sessionId: string;
  }

export async function jwtVerify(token: string){
    try{
        const decoded: decodedJwt = server.jwt.verify(token);
        return {
            valid: true,
            expired: false,
            decoded
        }
    }catch(e:any){
        console.log(e);
        return{
            valid: false,
            expired: e.code === 'FAST_JWT_EXPIRED',
            decoded: undefined,
            message: e.code
        }
    }

}


export async function authenticate(request: FastifyRequest, reply: FastifyReply){
    
    const accesstoken = request.headers.authorization?.split(" ")[1] || request.cookies.accessToken;
    const refreshtoken = request.headers['x-refresh'] as string || request.cookies.refreshToken;
    
    if( !accesstoken) {
        return reply.code(401).send({
            message: "NOT AUTHORIZED"
        })
    }

    const {decoded, expired, valid, message} = await jwtVerify(accesstoken as string);
    
    // if jwt is valid, just add the user to the request body.
    if(decoded){
        request.user = decoded;
        return;
    }

    
    // if the jwt has expired, than reissue the access token by using the refreshtoken
    if(expired && refreshtoken){
        const newAccessToken = await reIssueAccessToken(refreshtoken);
        if(newAccessToken){
            reply.header('x-access-token', newAccessToken);
        }

        const result = await jwtVerify(newAccessToken as string);
        request.user = result.decoded as decodedJwt;
        return;
    }

    return reply.code(401).send({
        error: message,
        message: "NOT AUTHORIZED"
    })

}


export async function reIssueAccessToken(refreshToken: string){
    const {decoded, expired} = await jwtVerify(refreshToken);
    console.log(decoded?.sessionId)

    if( !decoded || !decoded.sessionId || expired) {
        // set session valid to false, if refreshToken is also expired
        await updateSession({ id: decoded?.sessionId as string, valid: false})    
    }

    const session = await findSession(decoded?.sessionId as string);

    if(!session || !session.valid) return false;

    const user = await findUserbyID(session.userId);

    if(!user) return;


    // create accesstoken
    const {password, ...rest} = user;
    const payload = {...rest, sessionId: session.id}
    const accessToken = server.jwt.sign(payload, { expiresIn: "15mins" });

    return accessToken;

}