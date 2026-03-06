// Placeholder Saleor client skeleton
export class SaleorClient {
  constructor(private apiUrl: string, private token: string) {}

  async Do(query: string, variables: any): Promise<any> {
    // In a real skeleton, this would perform a fetch against Saleor's GraphQL API.
    // For the skeleton, return a canned response consistent with the contract shape.
    return { data: {} };
  }
}
