import crypto from 'node:crypto';

export async function createPasswordResetToken() {
    //1. we will send the resetToken by mail ( so that when a user hits our servers with this token we can verify it)
    const resetToken = crypto.randomBytes(32).toString('hex');

    //2. This hashed one will be saved in our db
    const resetTokenHashed = crypto.createHash('sha256').update(resetToken).digest('hex');

    // console.log({ resetToken, resetTokenHashed });

    return { resetToken, resetTokenHashed };

}