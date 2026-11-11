import { Request, Response } from 'express';
import { searchService, SearchService } from '../services/search/searchService';
import { ApiResponse, SearchResponseData } from '../types';

export class SearchController {
  private readonly service: SearchService;

  constructor(service?: SearchService) {
    this.service = service ?? searchService;
  }

  public search = async (req: Request, res: Response): Promise<void> => {
    const { query, maxResults } = req.body as { query: string; maxResults?: number };

    const searchData = await this.service.search(query, { maxResults });

    const response: ApiResponse<SearchResponseData> = {
      success: true,
      data: searchData,
    };

    res.status(200).json(response);
  };
}

export const searchController = new SearchController();
