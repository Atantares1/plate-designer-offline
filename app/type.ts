export type Reaction = {
    id: string;
    name: string;
    sampleNameParts?: string[]; // Original slash-separated parts for TSV export
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
