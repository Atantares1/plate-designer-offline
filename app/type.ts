export type Reaction = {
    id: string;
    name: string;
    primer: string;
    state: string;
    plateId?: string;
    position?: string; // Sample position (can be empty)
}

export type Well = {
    row: number;  
    col: string;  
    reaction?: Reaction;
}

export type plate = {
    wells: Well[][];
}
