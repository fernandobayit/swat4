export interface User {
    dn: string;
    username: string;
    given_name?: string;
    surname?: string;
    display_name?: string;
    email?: string;
    enabled: boolean;
    when_created?: string;
    member_of: string[];
    ou?: string;
}

export interface Group {
    dn: string;
    name: string;
    description?: string;
    members: string[];
    member_count: number;
    group_type?: string;
    ou?: string;
}



export interface Share {
    name: string;
    path?: string;
    comment?: string;
    veto_files?: string;
    write_list?: string;
}

export interface OUNode {
    dn: string;
    name: string;
    children: OUNode[];
}

export interface LogEntry {
    timestamp?: string;
    level?: string;
    source?: string;
    message: string;
}

export interface AuthUser {
    username: string;
    display_name: string;
    email?: string;
    dn: string;
    groups: string[];
}
