export type Reaction = {
    id: string;
    name: string;
    primer: string;
    state: string;
    plateId?: string;
}

export type Well = {
    row: number;  
    col: string;  
    reaction?: Reaction;
}

export type plate = {
    wells: Well[][];
}
