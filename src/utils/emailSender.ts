import { server } from '../app';

type optionsInput = {
    to: string,
    subject: string,
    message: string
}

export async function sendEmail(options: optionsInput) {
    //1. Create a transporter
    // This is already created and the nodemailer is set in the fastify Instance.

    //2. Define the email Options
    const mailOptions = {
        from: 'Admin <help@myDomain.com>',
        to: options.to,
        subject: options.subject,
        text: options.message
    }

    //3.send the mail
    await server.nodemailer.sendMail(mailOptions)

}