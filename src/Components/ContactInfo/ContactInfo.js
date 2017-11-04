// @flow
import React from 'react';
import type { Contact } from '../../Domain/Contact';
import ContactTypeIcon from '../ContactTypeIcon/ContactTypeIcon';

type Props = {
    contact: Contact;
    className?: string;
};

export default function ContactInfo({ contact, className }: Props): React.Element<*> {
    return (
        <span className={className}>
            <ContactTypeIcon type={contact.type} /> {contact.value}
        </span>
    );
}
