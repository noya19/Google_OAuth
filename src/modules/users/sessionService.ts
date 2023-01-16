import { jwtVerify } from "../../utils/jwtVerifty";
import prisma from "../../utils/prisma";

export async function createSession(userId: string, userAgent: string){
    const session = await prisma.session.create({
        data:{
            userId: userId,
            userAgent: userAgent
        }
    })

    return session;
}

interface findsessions{
    userId: string,
    valid?: boolean
}

export async function findSession(sessionId: string) {
    return await prisma.session.findUnique({
        where: {
            id: sessionId,
        }
    })
    
}

export async function findSessions(data: findsessions){
    const sessions = await prisma.session.findMany({
        where: {
            userId: data.userId,
            valid: data.valid
        }
    })
    
    return sessions;
}

interface updateSession{
    id: string,
    valid: boolean
}

export async function updateSession(data: updateSession){
    await prisma.session.update({
       where:{
        id: data.id
       },
       data: {
        valid: data.valid
       } 
    })
}

export async function deleteSession(data: updateSession){
    await prisma.session.delete({
       where:{
        id: data.id
       }
    })
}